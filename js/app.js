/**
 * Parawero - App para saber si necesitas paraguas hoy
 * 
 * Este archivo contiene toda la lógica para:
 * - Obtener la ubicación del usuario
 * - Conectar con la API de clima
 * - Aplicar el algoritmo de decisión sobre la necesidad de paraguas
 * - Actualizar la interfaz de usuario
 */

// Elementos del DOM
const loadingElement = document.getElementById('loading');
const resultElement = document.getElementById('result');
const errorElement = document.getElementById('error');
const errorMessageElement = document.getElementById('error-message');
const retryButton = document.getElementById('retry-button');
const locationNameElement = document.getElementById('location-name');
const dateElement = document.getElementById('date');
const recommendationElement = document.getElementById('recommendation');
const weatherDescriptionElement = document.getElementById('weather-description');
const weatherIconElement = document.getElementById('weather-icon');
const rainProbabilityElement = document.getElementById('rain-probability');
const temperatureElement = document.getElementById('temperature');
const cityForm = document.getElementById('city-form');
const cityInput = document.getElementById('city-input');
const timeButtons = document.querySelectorAll('.time-button');

// Variables de estado de la aplicación
let currentWeatherData = null;
let selectedTimeRange = 'today'; // Valor por defecto es "hoy"

// Configuración de la API - Usando funciones serverless
const NETLIFY_FUNCTION_URL = '/.netlify/functions/weather';

// Umbrales para la decisión de paraguas
const RAIN_PROBABILITY_THRESHOLD = 30; // Porcentaje a partir del cual se recomienda paraguas
const RAIN_INTENSITY_THRESHOLD = 0.5; // mm/h a partir del cual se recomienda paraguas

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Actualizar la fecha actual
    updateDate();
    
    // Iniciar el proceso principal
    initApp();
    
    // Configurar evento de reintentar
    retryButton.addEventListener('click', initApp);
    
    // Configurar evento de búsqueda por ciudad
    cityForm.addEventListener('submit', handleCitySearch);
    
    // Configurar eventos para los botones de franja horaria
    timeButtons.forEach(button => {
        button.addEventListener('click', handleTimeRangeSelection);
    });
});

/**
 * Maneja la selección de franja horaria
 */
function handleTimeRangeSelection(event) {
    // Eliminar la clase activa de todos los botones
    timeButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // Añadir la clase activa al botón seleccionado
    event.target.classList.add('active');
    
    // Guardar la franja horaria seleccionada
    selectedTimeRange = event.target.getAttribute('data-time');
    
    // Si ya tenemos datos del clima, actualizamos la interfaz para la nueva franja horaria
    if (currentWeatherData) {
        processWeatherDataForTimeRange(currentWeatherData, selectedTimeRange);
    }
}

/**
 * Función principal que inicia el flujo de la aplicación
 */
function initApp() {
    showLoading();
    
    // Intentar obtener la ubicación del usuario
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            handleLocationSuccess,
            handleLocationError,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    } else {
        showError('Tu navegador no soporta la geolocalización. Por favor, ingresa tu ubicación manualmente.');
        // Aquí se podría implementar una alternativa como un campo para ingresar la ubicación
    }
}

/**
 * Maneja la búsqueda por nombre de ciudad
 */
function handleCitySearch(event) {
    // Prevenir el comportamiento por defecto del formulario
    event.preventDefault();
    
    // Obtener el valor del input
    const cityName = cityInput.value.trim();
    
    if (!cityName) {
        showError('Por favor, introduce el nombre de una ciudad.');
        return;
    }
    
    showLoading();
    
    // Construir URL para la función serverless de geocodificación directa
    const geocodingUrl = `${NETLIFY_FUNCTION_URL}?endpoint=geo-direct&q=${encodeURIComponent(cityName)}`;
    
    console.log('Buscando coordenadas para:', cityName);
    
    fetch(geocodingUrl)
        .then(response => {
            if (!response.ok) {
                console.error('Error de respuesta:', response.status, response.statusText);
                throw new Error(`Error al buscar la ciudad: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Datos de geocodificación recibidos:', data);
            
            if (data && data.length > 0) {
                const { lat, lon, name, country } = data[0];
                
                // Actualizar el nombre de la ubicación
                locationNameElement.textContent = `${name}, ${country || ''}`.trim();
                
                // Obtener datos del clima con las coordenadas
                fetchWeatherData(lat, lon);
            } else {
                throw new Error('No se encontró ninguna ciudad con ese nombre.');
            }
        })
        .catch(error => {
            console.error('Error en geocodificación:', error);
            showError('No pudimos encontrar la ciudad. Por favor, verifica el nombre e inténtalo de nuevo.');
        });
}

/**
 * Maneja la obtención exitosa de la ubicación del usuario
 */
function handleLocationSuccess(position) {
    const { latitude, longitude } = position.coords;
    
    // Obtener el nombre de la ubicación (geocodificación inversa)
    getLocationName(latitude, longitude);
    
    // Obtener datos del clima con las coordenadas
    fetchWeatherData(latitude, longitude);
}

/**
 * Maneja errores en la obtención de la ubicación
 */
function handleLocationError(error) {
    let errorMessage;
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = 'No se ha permitido acceder a tu ubicación. Puedes buscar manualmente tu ciudad en el campo de búsqueda.';
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = 'La información de tu ubicación no está disponible en este momento. Puedes buscar manualmente tu ciudad en el campo de búsqueda.';
            break;
        case error.TIMEOUT:
            errorMessage = 'La solicitud para obtener tu ubicación ha expirado. Puedes buscar manualmente tu ciudad en el campo de búsqueda.';
            break;
        default:
            errorMessage = 'Ha ocurrido un error desconocido al obtener tu ubicación. Puedes buscar manualmente tu ciudad en el campo de búsqueda.';
    }
    
    showError(errorMessage);
}

/**
 * Obtiene el nombre de la ubicación mediante geocodificación inversa
 */
function getLocationName(latitude, longitude) {
    const geocodingUrl = `${NETLIFY_FUNCTION_URL}?endpoint=geo-reverse&lat=${latitude}&lon=${longitude}`;
    
    console.log('Obteniendo nombre de ubicación...');
    
    fetch(geocodingUrl)
        .then(response => {
            if (!response.ok) {
                console.error('Error de respuesta:', response.status, response.statusText);
                throw new Error(`Error al obtener el nombre de la ubicación: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Datos de geolocalización recibidos:', data);
            if (data && data.length > 0) {
                const { name, country } = data[0];
                locationNameElement.textContent = `${name}, ${country}`;
            } else {
                locationNameElement.textContent = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
            }
        })
        .catch(error => {
            console.error('Error en geocodificación inversa:', error);
            // Plan B: Usar las coordenadas directamente y continuar con la app
            locationNameElement.textContent = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
            // No mostrar error al usuario, solo usar las coordenadas
        });
}

/**
 * Obtiene los datos meteorológicos de la API a través de una función serverless
 */
function fetchWeatherData(latitude, longitude) {
    // Construir URL para la función serverless
    const weatherUrl = `${NETLIFY_FUNCTION_URL}?endpoint=weather&lat=${latitude}&lon=${longitude}&exclude=minutely,alerts`;
    
    console.log('Obteniendo datos meteorológicos...');
    
    fetch(weatherUrl)
        .then(response => {
            if (!response.ok) {
                console.error('Error de respuesta:', response.status, response.statusText);
                throw new Error(`Error al obtener datos meteorológicos: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Datos meteorológicos recibidos:', data);
            
            // Guardar los datos para poder cambiar entre franjas horarias sin hacer nuevas peticiones
            currentWeatherData = data;
            
            // Procesar los datos según la franja horaria seleccionada
            processWeatherDataForTimeRange(data, selectedTimeRange);
        })
        .catch(error => {
            console.error('Error en la API de clima:', error);
            
            // Si hay un error, mostrar mensaje al usuario
            showError('No hemos podido obtener la información meteorológica. Por favor, intenta nuevamente más tarde.');
        });
}

/**
 * Procesa los datos meteorológicos según la franja horaria seleccionada
 */
function processWeatherDataForTimeRange(data, timeRange) {
    try {
        // Verificar que tenemos datos válidos de la API OneCall 3.0
        if (!data || (!data.hourly && !data.daily)) {
            // Si estamos en modo demo con la estructura antigua
            if (data && data.list) {
                // Continuar con el modo antiguo para datos de demostración
                processLegacyFormatData(data, timeRange);
                return;
            }
            throw new Error('Datos meteorológicos inválidos');
        }
        
        // Obtener la fecha y hora actual
        const now = new Date();
        const currentHour = now.getHours();
        
        // Definir los rangos horarios
        let startHour, endHour;
        let dateOffset = 0; // 0 = hoy, 1 = mañana
        
        switch (timeRange) {
            case 'morning':
                startHour = 6;
                endHour = 11;
                break;
            case 'afternoon':
                startHour = 12;
                endHour = 17;
                break;
            case 'evening':
                startHour = 18;
                endHour = 23;
                break;
            case 'today':
            default:
                startHour = currentHour;
                endHour = 23;
                break;
        }
        
        // Si la hora actual es mayor que el final del rango seleccionado, asumimos que es para mañana
        if (timeRange !== 'today' && currentHour > endHour) {
            dateOffset = 1;
        }
        
        // Calcular fecha de inicio y fin para el rango seleccionado
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() + dateOffset);
        startDate.setHours(startHour, 0, 0, 0);
        
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + dateOffset);
        endDate.setHours(endHour, 59, 59, 999);
        
        // Actualizar el texto de fecha según la franja seleccionada
        updateDateDisplay(timeRange, dateOffset);
        
        // Filtrar pronósticos horarios para la franja seleccionada
        const hourlyForecasts = data.hourly || [];
        const forecastsForTimeRange = hourlyForecasts.filter(forecast => {
            const forecastDate = new Date(forecast.dt * 1000);
            return forecastDate >= startDate && forecastDate <= endDate;
        });
        
        // Si no hay pronósticos horarios para el rango, usar los diarios
        if (forecastsForTimeRange.length === 0 && data.daily && data.daily.length > dateOffset) {
            const dayForecast = data.daily[dateOffset];
            
            // Verificar si hay probabilidad de lluvia
            const rainProbability = (dayForecast.pop || 0) * 100;
            const rainAmount = dayForecast.rain || 0;
            
            // Usar temperatura apropiada según la franja horaria
            let temperature;
            if (timeRange === 'morning') {
                temperature = dayForecast.temp.morn;
            } else if (timeRange === 'afternoon') {
                temperature = dayForecast.temp.day;
            } else if (timeRange === 'evening') {
                temperature = dayForecast.temp.eve;
            } else {
                temperature = dayForecast.temp.day; // Para "today" usar temperatura del día
            }
            
            // Obtener condiciones meteorológicas
            const weather = dayForecast.weather && dayForecast.weather.length > 0
                ? dayForecast.weather[0]
                : { main: 'Clear', description: 'cielo despejado' };
            
            // Aplicar algoritmo de decisión
            const needsUmbrella = rainProbability >= RAIN_PROBABILITY_THRESHOLD || 
                                rainAmount >= RAIN_INTENSITY_THRESHOLD;
            
            // Mostrar resultado en la interfaz
            updateWeatherUI(needsUmbrella, {
                rainProbability: rainProbability,
                rainAmount: rainAmount,
                temperature: temperature,
                weatherCondition: weather.main,
                weatherDescription: weather.description
            });
            
            return;
        }
        
        // Analizar los pronósticos horarios para determinar si se necesita paraguas
        let maxRainProbability = 0;
        let accumulatedRain = 0;
        let averageTemperature = 0;
        let mainWeatherCondition = '';
        let mainWeatherDescription = '';
        
        forecastsForTimeRange.forEach(forecast => {
            // Probabilidad de lluvia (ya viene en formato decimal, multiplicamos por 100)
            const rainProbability = (forecast.pop || 0) * 100;
            maxRainProbability = Math.max(maxRainProbability, rainProbability);
            
            // Acumular precipitación (mm)
            const rainAmount = forecast.rain ? (forecast.rain['1h'] || 0) : 0;
            accumulatedRain += rainAmount;
            
            // Acumular temperatura
            averageTemperature += forecast.temp;
            
            // Guardar la condición climática principal si es lluvia
            if (forecast.weather && forecast.weather.length > 0) {
                const weather = forecast.weather[0];
                if (weather.main.toLowerCase().includes('rain') || 
                    weather.main.toLowerCase().includes('drizzle') || 
                    weather.main.toLowerCase().includes('thunderstorm')) {
                    mainWeatherCondition = weather.main;
                    mainWeatherDescription = weather.description;
                } else if (!mainWeatherCondition) {
                    mainWeatherCondition = weather.main;
                    mainWeatherDescription = weather.description;
                }
            }
        });
        
        // Calcular promedio de temperatura si hay pronósticos
        if (forecastsForTimeRange.length > 0) {
            averageTemperature /= forecastsForTimeRange.length;
        } else {
            // Usar temperatura actual como respaldo
            averageTemperature = data.current ? data.current.temp : 20;
        }
        
        // Aplicar algoritmo de decisión
        const needsUmbrella = maxRainProbability >= RAIN_PROBABILITY_THRESHOLD || 
                             accumulatedRain >= RAIN_INTENSITY_THRESHOLD;
        
        // Mostrar resultado en la interfaz
        updateWeatherUI(needsUmbrella, {
            rainProbability: maxRainProbability,
            rainAmount: accumulatedRain,
            temperature: averageTemperature,
            weatherCondition: mainWeatherCondition || (data.current && data.current.weather && data.current.weather[0] ? data.current.weather[0].main : ''),
            weatherDescription: mainWeatherDescription || (data.current && data.current.weather && data.current.weather[0] ? data.current.weather[0].description : 'Condiciones normales')
        });
        
    } catch (error) {
        console.error('Error al procesar datos meteorológicos:', error);
        showError('Ha ocurrido un error al procesar los datos meteorológicos.');
    }
}

/**
 * Procesa los datos en formato antiguo (para mantener compatibilidad con el modo demo)
 */
function processLegacyFormatData(data, timeRange) {
    // Implementación simplificada para el modo demo
    // El modo demo no tiene capacidad para mostrar diferentes franjas horarias
    // por lo que mostramos siempre los mismos datos
    
    try {
        if (!data || !data.list || data.list.length === 0) {
            throw new Error('Datos meteorológicos inválidos');
        }
        
        // Actualizar el texto de fecha según la franja seleccionada
        updateDateDisplay(timeRange, 0);
        
        // Para el modo demo, usamos los mismos datos independientemente de la franja seleccionada
        let maxRainProbability = 0;
        let accumulatedRain = 0;
        let averageTemperature = 0;
        let mainWeatherCondition = '';
        let mainWeatherDescription = '';
        
        data.list.forEach(forecast => {
            // Probabilidad de lluvia
            const rainProbability = (forecast.pop || 0) * 100;
            maxRainProbability = Math.max(maxRainProbability, rainProbability);
            
            // Acumular precipitación
            const rainAmount = forecast.rain ? (forecast.rain['3h'] || 0) : 0;
            accumulatedRain += rainAmount;
            
            // Acumular temperatura
            averageTemperature += forecast.main.temp;
            
            // Guardar la condición climática
            if (forecast.weather && forecast.weather.length > 0) {
                const weather = forecast.weather[0];
                if (weather.main.toLowerCase().includes('rain') || 
                    weather.main.toLowerCase().includes('drizzle') || 
                    weather.main.toLowerCase().includes('thunderstorm')) {
                    mainWeatherCondition = weather.main;
                    mainWeatherDescription = weather.description;
                } else if (!mainWeatherCondition) {
                    mainWeatherCondition = weather.main;
                    mainWeatherDescription = weather.description;
                }
            }
        });
        
        // Calcular promedio de temperatura
        averageTemperature /= data.list.length;
        
        // Aplicar algoritmo de decisión
        const needsUmbrella = maxRainProbability >= RAIN_PROBABILITY_THRESHOLD || 
                             accumulatedRain >= RAIN_INTENSITY_THRESHOLD;
        
        // Mostrar resultado en la interfaz
        updateWeatherUI(needsUmbrella, {
            rainProbability: maxRainProbability,
            rainAmount: accumulatedRain,
            temperature: averageTemperature,
            weatherCondition: mainWeatherCondition,
            weatherDescription: mainWeatherDescription
        });
        
    } catch (error) {
        console.error('Error al procesar datos meteorológicos:', error);
        showError('Ha ocurrido un error al procesar los datos meteorológicos.');
    }
}

/**
 * Actualiza el texto de la fecha según la franja horaria seleccionada
 */
function updateDateDisplay(timeRange, dateOffset) {
    const now = new Date();
    if (dateOffset > 0) {
        now.setDate(now.getDate() + dateOffset);
    }
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let timeText = '';
    
    switch (timeRange) {
        case 'morning':
            timeText = 'Por la mañana (6:00 - 12:00)';
            break;
        case 'afternoon':
            timeText = 'Por la tarde (12:00 - 18:00)';
            break;
        case 'evening':
            timeText = 'Por la noche (18:00 - 24:00)';
            break;
        case 'today':
        default:
            timeText = 'Durante el día';
            break;
    }
    
    const dateString = now.toLocaleDateString('es-ES', options);
    dateElement.textContent = `${dateString} · ${timeText}`;
}

/**
 * Actualiza la fecha actual en formato legible
 */
function updateDate() {
    updateDateDisplay(selectedTimeRange, 0);
}

// Funciones para manejar estados de la interfaz

function showLoading() {
    loadingElement.classList.remove('hidden');
    resultElement.classList.add('hidden');
    errorElement.classList.add('hidden');
}

function showResult() {
    loadingElement.classList.add('hidden');
    resultElement.classList.remove('hidden');
    errorElement.classList.add('hidden');
}

function showError(message) {
    loadingElement.classList.add('hidden');
    resultElement.classList.add('hidden');
    errorElement.classList.remove('hidden');
    errorMessageElement.textContent = message;
}

/**
 * Actualiza la interfaz con la recomendación y datos meteorológicos
 */
function updateWeatherUI(needsUmbrella, weatherData) {
    // Actualizar recomendación
    if (needsUmbrella) {
        recommendationElement.textContent = '¡Lleva paraguas!';
        weatherIconElement.innerHTML = '☔';
        recommendationElement.style.color = 'var(--primary-color)';
    } else {
        recommendationElement.textContent = 'No necesitas paraguas';
        weatherIconElement.innerHTML = '☀️';
        recommendationElement.style.color = 'var(--success-color)';
    }
    
    // Actualizar descripción y detalles
    weatherDescriptionElement.textContent = capitalizeFirstLetter(weatherData.weatherDescription || 'Condiciones normales');
    rainProbabilityElement.textContent = `${Math.round(weatherData.rainProbability)}%`;
    temperatureElement.textContent = `${Math.round(weatherData.temperature)}°C`;
    
    // Mostrar la sección de resultados
    showResult();
}

/**
 * Capitaliza la primera letra de un texto
 */
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Función para manejo manual de ubicación (a implementar si se quiere ofrecer esa alternativa)
function setupManualLocationInput() {
    // Esta función implementaría un campo de entrada para la ubicación manual
    // como alternativa cuando no hay geolocalización disponible
    console.log('Implementación pendiente: entrada de ubicación manual');
}