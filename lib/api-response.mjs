// API proxies sometimes return an HTML hosting error page instead of JSON.
// Keep that implementation detail out of customer and admin-facing messages.
export async function readApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!contentType.includes('application/json')) {
    const error = new Error(
      'The service is temporarily unavailable. Please try again in a moment.',
    );
    error.status = response.status;
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('The service returned an invalid response. Please try again.');
    error.status = response.status;
    throw error;
  }
}
