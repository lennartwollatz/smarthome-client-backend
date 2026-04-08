import { DeviceWeather, WeatherForecastEntry, WeatherHourlyEntry } from "../../../../../model/devices/DeviceWeather.js";
import { OpenMeteoResponse, WeatherDeviceController } from "../weatherDeviceController.js";

export class WeatherDevice extends DeviceWeather {
    constructor(init?: Partial<DeviceWeather>) {
        super(init);
    }
    private weatherController?: WeatherDeviceController;

    setWeatherController(controller?: WeatherDeviceController) {
        this.weatherController = controller;
    }

    async updateValues(): Promise<void> {
        const data = await this.weatherController?.fetchWeather(this);
        if(data) {
            this.updateValuesFromPayload(data, false);
        }
    }

    public updateValuesFromPayload(data: OpenMeteoResponse, trigger: boolean = false): void {
        const curr = data.current;
        const temp = curr?.temperature_2m ?? null;
        const code = curr?.weather_code ?? null;
        const humidity = curr?.relative_humidity_2m ?? null;
        const pressure = curr?.surface_pressure ?? null;
        const precipitationProbability = curr?.precipitation_probability ?? null;
        const uv = data.daily?.uv_index_max?.[0];
        const rain = curr?.rain ?? null;
        const showers = curr?.showers ?? null;
        const snowfall = curr?.snowfall ?? null;
        const visibility = curr?.visibility ?? null;
        const windDirection = curr?.wind_direction_10m ?? null;

        if(typeof temp === "number" && temp !== this.temperature) this.setTemperature(temp, trigger);
        if(typeof code === "number" && code !== this.weatherCode) this.setWeatherCode(code, trigger);
        if(typeof humidity === "number" && humidity !== this.humidity) this.setHumidity(humidity, trigger);
        if(typeof precipitationProbability === "number" && precipitationProbability !== this.precipitationProbability) this.setPrecipitationProbability(precipitationProbability, trigger);
        if(typeof uv === "number" && uv !== this.uvIndex) this.setUvIndex(uv, trigger);

        if(typeof rain === "number" ) this.rain = rain;
        if(typeof showers === "number" ) this.showers = showers;
        if(typeof snowfall === "number" ) this.snowfall = snowfall;
        if(typeof visibility === "number" ) this.visibility = visibility;
        if(typeof windDirection === "number" ) this.windDirection = windDirection;

        this.forecast = this.buildForecast(data);
        this.hourlyForecast = this.buildHourlyForecast(data);

        const windSpeedMps = typeof curr?.wind_speed_10m === "number" ? curr.wind_speed_10m / 3.6 : undefined;
        if(typeof windSpeedMps === "number") this.windSpeedMps = windSpeedMps;
        if(typeof pressure === "number") this.pressure = Math.round(pressure);


        const hourly = data.hourly;
        if (hourly?.snow_depth?.length) {
            const now = new Date();
            let idx = 0;
            for (let i = 0; i < (hourly.time?.length ?? 0); i++) {
            const t = new Date(hourly.time![i] ?? "");
            if (t >= now) {
                idx = i;
                break;
            }
            }
            const sd = hourly.snow_depth?.[idx];
            this.snowDepth = typeof sd === "number" ? sd : undefined;
        }

        const daily = data.daily;
        const d0 = daily?.time?.[0];
        if (daily && d0) {
            this.temperatureMax = this.num(daily.temperature_2m_max?.[0]);
            this.temperatureMin = this.num(daily.temperature_2m_min?.[0]);
            this.sunrise = this.str(daily.sunrise?.[0]);
            this.sunset = this.str(daily.sunset?.[0]);
            this.daylightDuration = this.num(daily.daylight_duration?.[0]);
            this.sunshineDuration = this.num(daily.sunshine_duration?.[0]);
            this.rainSum = this.num(daily.rain_sum?.[0]);
            this.showersSum = this.num(daily.showers_sum?.[0]);
            this.snowfallSum = this.num(daily.snowfall_sum?.[0]);
            const wsm = daily.wind_speed_10m_max?.[0];
            this.windSpeedMax = typeof wsm === "number" ? wsm / 3.6 : undefined;
            this.windDirectionDominant = this.num(daily.wind_direction_10m_dominant?.[0]);
        }

    }

    private num(val: number | null | undefined): number | undefined {
    return typeof val === "number" ? val : undefined;
    }

    private str(val: string | null | undefined): string | undefined {
    return typeof val === "string" ? val : undefined;
    }

    private buildForecast(data: OpenMeteoResponse): WeatherForecastEntry[] {
        const entries: WeatherForecastEntry[] = [];
        const daily = data.daily;
        if (!daily?.time?.length) return entries;

        const times = daily.time;
        const temps = daily.temperature_2m_max ?? daily.temperature_2m_min ?? [];
        const codes = daily.weather_code ?? [];

        for (let i = 0; i < Math.min(times.length, 3); i++) {
            const temp = temps[i] ?? null;
            const code = codes[i] ?? null;
            const codeNum = typeof code === "number" ? code : 0;
            const tempNum = typeof temp === "number" ? temp : 0;

            entries.push({
            datetime: times[i] ?? "",
            temperature: tempNum,
            weatherCode: codeNum,
            });
        }

        return entries;
    }

    private buildHourlyForecast(data: OpenMeteoResponse): WeatherHourlyEntry[] {
        const entries: WeatherHourlyEntry[] = [];
        const hourly = data.hourly;
        if (!hourly?.time?.length) return entries;

        const times = hourly.time;
        const temps = hourly.temperature_2m ?? [];
        const codes = hourly.weather_code ?? [];
        const precip = hourly.precipitation_probability ?? [];

        const now = new Date();
        let startIdx = 0;
        for (let i = 0; i < times.length; i++) {
            const t = new Date(times[i] ?? "");
            if (t >= now) {
            startIdx = i;
            break;
            }
        }

        for (let i = startIdx; i < Math.min(startIdx + 24, times.length); i++) {
            const temp = temps[i] ?? null;
            const code = codes[i] ?? null;
            const pr = precip[i] ?? null;
            entries.push({
            datetime: times[i] ?? "",
            temperature: typeof temp === "number" ? temp : 0,
            weatherCode: typeof code === "number" ? code : 0,
            precipitationProbability: typeof pr === "number" ? pr : undefined,
            });
        }

        return entries.slice(0, 24);
    }

}