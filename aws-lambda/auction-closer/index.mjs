/**
 * AWS Lambda Function: Auction Closer
 *
 * Invoked by EventBridge Scheduler to close auctions at exact end_time.
 * Makes HTTP POST request to Vercel API endpoint.
 *
 * Environment Variables Required:
 * - API_ENDPOINT: Full URL to the close endpoint (e.g., https://your-app.vercel.app/api/auctions/eventbridge/close)
 */

export const handler = async (event) => {
  console.log('Auction Closer Lambda invoked', { event });

  const apiEndpoint = process.env.API_ENDPOINT;

  if (!apiEndpoint) {
    console.error('Missing API_ENDPOINT environment variable');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing API_ENDPOINT configuration' }),
    };
  }

  // Extract auction data from event
  const { auctionId, source, scheduledTime } = event;

  if (!auctionId) {
    console.error('Missing auctionId in event payload');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing auctionId' }),
    };
  }

  console.log(`Processing auction ${auctionId}`, {
    source,
    scheduledTime,
    apiEndpoint,
  });

  try {
    // Make HTTP POST request to Vercel API
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-EventBridge-Source': 'aws.scheduler',
        'User-Agent': 'AWS-Lambda-Auction-Closer',
      },
      body: JSON.stringify({
        auctionId,
        source: source || 'eventbridge-scheduler',
        scheduledTime: scheduledTime || new Date().toISOString(),
      }),
    });

    const responseText = await response.text();

    console.log('API Response', {
      status: response.status,
      statusText: response.statusText,
      body: responseText,
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${responseText}`);
    }

    const data = responseText ? JSON.parse(responseText) : {};

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        auctionId,
        message: 'Auction closed successfully',
        apiResponse: data,
      }),
    };
  } catch (error) {
    console.error('Error calling API endpoint:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        auctionId,
      }),
    };
  }
};
