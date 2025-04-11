// Función serverless de Netlify para manejar llamadas a la API de OpenWeatherMap
// Esto protege tu API key al no exponerla en el frontend

exports.handler = async function(event) {
  // Sólo aceptar solicitudes GET
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Método no permitido' };
  }
  
  try {
    // Obtener los parámetros de la solicitud
    const params = event.queryStringParameters;
    
    // Validar que tenemos el parámetro endpoint
    if (!params.endpoint) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Falta el parámetro endpoint' })
      };
    }
    
    // Preparar la URL para la API de OpenWeatherMap
    let apiUrl = '';
    
    const API_KEY = process.env.WEATHER_API_KEY;

    if (!API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'API key no configurada en el servidor' })
      };
    }
    
    // Determinar qué endpoint usar y validar los parámetros específicos de cada endpoint
    if (params.endpoint === 'weather') {
      // Validar parámetros para el endpoint weather
      if (!params.lat || !params.lon) {
        return { 
          statusCode: 400, 
          body: JSON.stringify({ error: 'Faltan parámetros lat y/o lon para el endpoint weather' })
        };
      }
      
      // OneCall API
      const exclude = params.exclude || 'minutely,alerts';
      apiUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${params.lat}&lon=${params.lon}&units=metric&exclude=${exclude}&appid=${API_KEY}`;
    } else if (params.endpoint === 'geo-reverse') {
      // Validar parámetros para geocoding inverso
      if (!params.lat || !params.lon) {
        return { 
          statusCode: 400, 
          body: JSON.stringify({ error: 'Faltan parámetros lat y/o lon para el endpoint geo-reverse' })
        };
      }
      
      // Geocoding inverso API
      apiUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${params.lat}&lon=${params.lon}&limit=1&appid=${API_KEY}`;
    } else if (params.endpoint === 'geo-direct') {
      // Validar el parámetro q para geocoding directo
      if (!params.q) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Falta el parámetro q (ciudad) para el endpoint geo-direct' })
        };
      }
      
      // Geocoding directo API
      apiUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(params.q)}&limit=1&appid=${API_KEY}`;
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Endpoint no válido' })
      };
    }
    
    // Llamar a la API de OpenWeatherMap
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ 
          error: `Error en la API de OpenWeatherMap: ${response.status} ${response.statusText}` 
        })
      };
    }
    
    const data = await response.json();
    
    // Devolver los datos al cliente
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
    
  } catch (error) {
    console.error('Error en serverless function:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error del servidor' })
    };
  }
};