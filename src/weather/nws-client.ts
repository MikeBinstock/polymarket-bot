import { createLogger } from '../utils/logger';

const logger = createLogger('NWSClient');

// NWS API base URL
const NWS_API_URL = 'https://api.weather.gov';
const USER_AGENT = 'PolymarketWeatherBot/1.0 (weather-bot@polymarket.app)';

// City configurations matching Polymarket settlement stations
export const CITIES: Record<string, { name: string; lat: number; lon: number; station: string }> = {
  NYC: { name: 'New York City', lat: 40.7128, lon: -74.0060, station: 'KNYC' },
  LA: { name: 'Los Angeles', lat: 34.0522, lon: -118.2437, station: 'KLAX' },
  Chicago: { name: 'Chicago', lat: 41.8781, lon: -87.6298, station: 'KORD' },
  Miami: { name: 'Miami', lat: 25.7617, lon: -80.1918, station: 'KMIA' },
  Dallas: { name: 'Dallas', lat: 32.7767, lon: -96.7970, station: 'KDFW' },
  Seattle: { name: 'Seattle', lat: 47.6062, lon: -122.3321, station: 'KSEA' },
};

export interface HourlyForecast {
  startTime: string;
  endTime: string;
  temperature: number;
  temperatureUnit: string;
  isDaytime: boolean;
  shortForecast: string;
}

export interface DailyForecast {
  date: string;
  highTemp: number;
  lowTemp: number;
  confidence: 'very_high' | 'high' | 'medium' | 'low';
  hoursUntil: number;
  shortForecast: string;
}

export interface GridPoint {
  office: string;
  gridX: number;
  gridY: number;
  forecastUrl: string;
  forecastHourlyUrl: string;
}

export class NWSClient {
  private gridPointCache: Map<string, GridPoint> = new Map();

  /**
   * Get grid point data for a location (cached)
   */
  async getGridPoint(lat: number, lon: number): Promise<GridPoint> {
    const cacheKey = `${lat},${lon}`;
    
    if (this.gridPointCache.has(cacheKey)) {
      return this.gridPointCache.get(cacheKey)!;
    }

    try {
      const response = await fetch(`${NWS_API_URL}/points/${lat},${lon}`, {
        headers: { 'User-Agent': USER_AGENT }
      });

      if (!response.ok) {
        throw new Error(`NWS API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const props = data.properties;

      const gridPoint: GridPoint = {
        office: props.gridId,
        gridX: props.gridX,
        gridY: props.gridY,
        forecastUrl: props.forecast,
        forecastHourlyUrl: props.forecastHourly,
      };

      this.gridPointCache.set(cacheKey, gridPoint);
      return gridPoint;
    } catch (error) {
      logger.error(`Failed to get grid point for ${lat},${lon}:`, error);
      throw error;
    }
  }

  /**
   * Fetch hourly forecast for a location
   */
  async getHourlyForecast(lat: number, lon: number): Promise<HourlyForecast[]> {
    try {
      const gridPoint = await this.getGridPoint(lat, lon);
      
      const response = await fetch(gridPoint.forecastHourlyUrl, {
        headers: { 'User-Agent': USER_AGENT }
      });

      if (!response.ok) {
        throw new Error(`NWS forecast error: ${response.status}`);
      }

      const data = await response.json() as any;
      const periods = data.properties.periods;

      return periods.map((p: any) => ({
        startTime: p.startTime,
        endTime: p.endTime,
        temperature: p.temperature,
        temperatureUnit: p.temperatureUnit,
        isDaytime: p.isDaytime,
        shortForecast: p.shortForecast,
      }));
    } catch (error) {
      logger.error(`Failed to get hourly forecast:`, error);
      throw error;
    }
  }

  /**
   * Get daily high temperature forecast for a specific date
   */
  async getDailyHigh(cityCode: string, targetDate: Date): Promise<DailyForecast | null> {
    const city = CITIES[cityCode];
    if (!city) {
      throw new Error(`Unknown city: ${cityCode}`);
    }

    try {
      const hourlyForecasts = await this.getHourlyForecast(city.lat, city.lon);
      
      // Filter forecasts for the target date
      const targetDateStr = targetDate.toISOString().split('T')[0];
      const dayForecasts = hourlyForecasts.filter(f => {
        const forecastDate = new Date(f.startTime).toISOString().split('T')[0];
        return forecastDate === targetDateStr;
      });

      if (dayForecasts.length === 0) {
        logger.warn(`No forecasts found for ${cityCode} on ${targetDateStr}`);
        return null;
      }

      // Find high and low temperatures
      const temps = dayForecasts.map(f => f.temperature);
      const highTemp = Math.max(...temps);
      const lowTemp = Math.min(...temps);

      // Calculate hours until target date
      const now = new Date();
      const hoursUntil = Math.max(0, (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60));

      // Determine confidence based on forecast horizon
      let confidence: 'very_high' | 'high' | 'medium' | 'low';
      if (hoursUntil <= 24) {
        confidence = 'very_high';
      } else if (hoursUntil <= 48) {
        confidence = 'high';
      } else if (hoursUntil <= 72) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }

      // Get a representative short forecast
      const daytimeForecasts = dayForecasts.filter(f => f.isDaytime);
      const shortForecast = daytimeForecasts.length > 0 
        ? daytimeForecasts[0].shortForecast 
        : dayForecasts[0].shortForecast;

      return {
        date: targetDateStr,
        highTemp,
        lowTemp,
        confidence,
        hoursUntil: Math.round(hoursUntil),
        shortForecast,
      };
    } catch (error) {
      logger.error(`Failed to get daily high for ${cityCode}:`, error);
      throw error;
    }
  }

  /**
   * Get forecasts for all tracked cities for a specific date
   */
  async getAllCityForecasts(targetDate: Date): Promise<Map<string, DailyForecast>> {
    const forecasts = new Map<string, DailyForecast>();
    
    for (const [cityCode, city] of Object.entries(CITIES)) {
      try {
        const forecast = await this.getDailyHigh(cityCode, targetDate);
        if (forecast) {
          forecasts.set(cityCode, forecast);
        }
        // Small delay between requests to be respectful to NWS API
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        logger.error(`Failed to fetch forecast for ${cityCode}:`, error);
      }
    }

    return forecasts;
  }

  /**
   * Get standard deviation for confidence level (used in probability calculations)
   */
  static getStdDev(confidence: 'very_high' | 'high' | 'medium' | 'low'): number {
    const stdDevs = {
      very_high: 1.5,  // ±2°F ~80% of time
      high: 2.0,       // ±3°F ~90% of time
      medium: 3.0,     // ±5°F ~95% of time
      low: 4.5,        // Wider spread
    };
    return stdDevs[confidence];
  }
}

