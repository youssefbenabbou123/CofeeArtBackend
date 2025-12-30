import pkg from 'square';
const { SquareClient, SquareEnvironment } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Initialize Square
let squareClient = null;
let squareInitError = null;

const accessToken = process.env.SQUARE_ACCESS_TOKEN;
const applicationId = process.env.SQUARE_APPLICATION_ID;
const environment = process.env.SQUARE_ENVIRONMENT || 'sandbox'; // 'sandbox' or 'production'
const locationIdOverride = process.env.SQUARE_LOCATION_ID; // Optional: set if API call fails

// Debug: Show token info (only in development)
if (process.env.NODE_ENV !== 'production') {
  console.log('🔍 Square Debug Info:');
  console.log('   Token from ENV:', process.env.SQUARE_ACCESS_TOKEN ? 'YES' : 'NO (using fallback)');
  console.log('   Token starts with:', accessToken.substring(0, 10) + '...');
  console.log('   Token ends with:', '...' + accessToken.substring(accessToken.length - 10));
  console.log('   Token length:', accessToken.length);
}

if (accessToken && applicationId) {
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [DEBUG] Initializing Square Client:');
      console.log('   Access token length:', accessToken.length);
      console.log('   Access token starts with:', accessToken.substring(0, 15));
      console.log('   Access token ends with:', accessToken.substring(accessToken.length - 15));
      console.log('   Application ID:', applicationId);
      console.log('   Environment:', environment);
    }

    squareClient = new SquareClient({
      accessToken: accessToken,
      environment: environment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
      squareVersion: '2025-12-30', // Match Postman working version
    });

    console.log(`✅ Square initialized successfully (${environment})`);
  } catch (error) {
    squareInitError = error.message;
    console.error('❌ Error initializing Square:', error.message);
    console.error('   Error stack:', error.stack);
  }
} else {
  squareInitError = 'SQUARE_ACCESS_TOKEN or SQUARE_APPLICATION_ID not set';
  console.warn('⚠️  Square credentials not set. Payment functionality will be disabled.');
  console.warn('   Please add SQUARE_ACCESS_TOKEN and SQUARE_APPLICATION_ID to your .env file and restart the server.');
  console.warn('   For deployed services, add them to environment variables in your hosting platform.');
}

/**
 * Get Square location ID (required for payments)
 * @returns {Promise<string>} Location ID
 */
export async function getLocationId() {
  if (!squareClient) {
    throw new Error('Square is not configured. Please set SQUARE_ACCESS_TOKEN and SQUARE_APPLICATION_ID.');
  }

  // Test: Try to list locations to verify authentication
  // If location ID is provided as environment variable, use it
  if (locationIdOverride) {
    console.log('✅ [DEBUG] Using location ID from SQUARE_LOCATION_ID environment variable:', locationIdOverride);
    return locationIdOverride;
  }

  // Debug: Log token information
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('SQUARE_ACCESS_TOKEN is not set in environment variables');
  }
  console.log('🔍 [DEBUG] getLocationId - Attempting to fetch from API:');
  console.log('   Token length:', token.length);
  console.log('   Token starts with:', token.substring(0, 15));
  console.log('   Environment:', process.env.SQUARE_ENVIRONMENT || 'sandbox');
  console.log('   Square client initialized:', !!squareClient);
  console.log('   Square client environment:', squareClient._options?.environment);

  try {
    console.log('🔍 [DEBUG] Calling squareClient.locations.list()...');
    const response = await squareClient.locations.list();
    console.log('🔍 [DEBUG] Response received:', {
      hasResult: !!response.result,
      hasLocations: !!response.result?.locations,
      locationsCount: response.result?.locations?.length || 0
    });

    if (response.result && response.result.locations && response.result.locations.length > 0) {
      const locationId = response.result.locations[0].id;
      console.log('✅ [DEBUG] Location ID retrieved from API:', locationId);
      console.log('   Location name:', response.result.locations[0].name);
      return locationId;
    } else {
      console.error('❌ [DEBUG] No locations in response:', JSON.stringify(response, null, 2));
      throw new Error('No locations found. Please create a location in your Square dashboard.');
    }
  } catch (error) {
    console.error('❌ [DEBUG] Error getting location ID from API:');
    console.error('   Status code:', error.statusCode);
    console.error('   Error code:', error.errors?.[0]?.code);
    console.error('   Error detail:', error.errors?.[0]?.detail);

    if (error.statusCode === 401) {
      console.error('\n⚠️  [DEBUG] 401 Unauthorized - Cannot fetch location ID from API');
      console.error('   This is OK if you control the Square account directly.');
      console.error('   You can get the Location ID from your Square Dashboard:');
      console.error('   1. Go to: https://squareup.com/dashboard');
      console.error('   2. Go to Settings → Locations');
      console.error('   3. Click on your location');
      console.error('   4. Copy the Location ID from the URL or settings');
      console.error('   5. Add it to your .env file as: SQUARE_LOCATION_ID=your-location-id');
      console.error('\n   Or enable LOCATIONS_READ permission in Square Developer Dashboard.');

      throw new Error('Cannot fetch location ID. Please set SQUARE_LOCATION_ID in your .env file or enable LOCATIONS_READ permission. See logs above for instructions.');
    }
    throw error;
  }
}

/**
 * Create a payment
 * @param {string} sourceId - Payment source ID (from Square payment form)
 * @param {number} amount - Amount in euros
 * @param {string} currency - Currency code (default: 'EUR')
 * @param {string} idempotencyKey - Unique key for idempotency
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Payment result
 */
export async function createPayment(sourceId, amount, currency = 'EUR', idempotencyKey, metadata = {}) {
  if (!squareClient) {
    const errorMsg = squareInitError
      ? `Square is not configured: ${squareInitError}`
      : 'Square is not configured. Please set SQUARE_ACCESS_TOKEN and SQUARE_APPLICATION_ID.';
    throw new Error(errorMsg);
  }

  try {
    const locationId = await getLocationId();

    // Convert euros to cents
    const amountInCents = Math.round(amount * 100);

    const response = await squareClient.payments.createPayment({
      sourceId: sourceId,
      idempotencyKey: idempotencyKey,
      amountMoney: {
        amount: BigInt(amountInCents), // Must be BigInt
        currency: currency,
      },
      locationId: locationId,
      note: JSON.stringify(metadata),
    });

    if (response.result && response.result.payment) {
      return {
        success: true,
        paymentId: response.result.payment.id,
        status: response.result.payment.status,
      };
    } else {
      throw new Error('Payment creation failed: ' + JSON.stringify(response.errors || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error creating payment:', error);
    throw error;
  }
}

/**
 * Process a refund
 * @param {string} paymentId - Square payment ID
 * @param {number} amount - Amount to refund in euros (optional, full refund if not provided)
 * @param {string} reason - Refund reason
 * @returns {Promise<Object>} Refund object
 */
export async function processRefund(paymentId, amount = null, reason = 'REQUESTED_BY_CUSTOMER') {
  if (!squareClient) {
    throw new Error('Square is not configured. Please set SQUARE_ACCESS_TOKEN and SQUARE_APPLICATION_ID.');
  }

  try {
    const refundRequest = {
      idempotencyKey: `refund-${paymentId}-${Date.now()}`,
      paymentId: paymentId,
      reason: reason,
    };

    if (amount) {
      // Convert euros to cents
      refundRequest.amountMoney = {
        amount: BigInt(Math.round(amount * 100)), // Must be BigInt
        currency: 'EUR',
      };
    }

    const response = await squareClient.refunds.refundPayment(refundRequest);

    if (response.result && response.result.refund) {
      return {
        success: true,
        refundId: response.result.refund.id,
        amount: Number(response.result.refund.amountMoney.amount) / 100, // Convert BigInt to number, then cents to euros
        status: response.result.refund.status,
      };
    } else {
      throw new Error('Refund failed: ' + JSON.stringify(response.errors || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error processing refund:', error);
    throw error;
  }
}

/**
 * Create a Square Checkout Link
 * Uses direct HTTP request (like Postman) to ensure correct headers
 * @param {Array} lineItems - Array of line items for the checkout
 * @param {string} successUrl - URL to redirect on success
 * @param {string} cancelUrl - URL to redirect on cancel
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Checkout link
 */
export async function createCheckoutLink(lineItems, successUrl, cancelUrl, metadata = {}) {
  if (!accessToken) {
    throw new Error('Square is not configured. Please set SQUARE_ACCESS_TOKEN in environment variables.');
  }

  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [DEBUG] createCheckoutLink - Starting (Direct HTTP):');
      console.log('   Line items count:', lineItems.length);
      console.log('   Success URL:', successUrl);
      console.log('   Cancel URL:', cancelUrl);
      console.log('   Metadata:', JSON.stringify(metadata, null, 2));
    }

    const locationId = await getLocationId();
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [DEBUG] Location ID obtained:', locationId);
    }

    // Helper function to convert amount to cents safely
    // ALWAYS expects amount in EUROS (e.g., 35.00), converts to cents (3500)
    const toSquareCents = (amount) => {
      if (amount === 0) return 0;
      
      const amountNum = parseFloat(amount);
      
      // Sanity check: if amount is suspiciously large (> 10000€ = 1,000,000 cents)
      // it might already be in cents by mistake
      if (amountNum > 10000) {
        console.warn(`⚠️ WARNING: Amount ${amountNum} seems very large. Is it already in cents?`);
        // If it's a round number (no decimals), it's likely already in cents
        if (amountNum % 1 === 0 && amountNum > 100) {
          console.warn(`⚠️ Treating ${amountNum} as CENTS (not converting)`);
          return Math.round(amountNum);
        }
      }
      
      // Normal case: amount is in euros, convert to cents
      const cents = Math.round(amountNum * 100);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`💰 Converting: ${amountNum}€ → ${cents} cents`);
      }
      return cents;
    };

    // Convert line items to Square format (snake_case, like Postman)
    const squareLineItems = lineItems.map(item => {
      const rawAmount = item.amount || item.price || 0;
      const amountInCents = toSquareCents(rawAmount);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔍 [DEBUG] Line item "${item.name}": raw=${rawAmount} → cents=${amountInCents}`);
      }
      
      return {
        name: item.name || 'Item',
        quantity: (item.quantity || 1).toString(),
        base_price_money: {
          amount: amountInCents,
          currency: 'EUR',
        },
      };
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [DEBUG] Square line items:', JSON.stringify(squareLineItems, null, 2));
    }

    // Build request body exactly like Postman (snake_case)
    const requestBody = {
      idempotency_key: `checkout-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      order: {
        location_id: locationId,
        line_items: squareLineItems,
      },
      checkout_options: {
        redirect_url: successUrl,
        ask_for_shipping_address: true,
      },
    };

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [DEBUG] Payment link request body:', JSON.stringify(requestBody, null, 2));
    }

    // Determine API URL based on environment
    const baseUrl = environment === 'production' 
      ? 'https://connect.squareup.com' 
      : 'https://connect.squareupsandbox.com';
    const apiUrl = `${baseUrl}/v2/online-checkout/payment-links`;

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [DEBUG] Calling Square API directly:');
      console.log('   URL:', apiUrl);
      console.log('   Method: POST');
    }

    // Make direct HTTP request like Postman
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Square-Version': '2025-12-30',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 [DEBUG] Response status:', response.status);
      console.log('🔍 [DEBUG] Response body:', JSON.stringify(data, null, 2));
    }

    if (!response.ok) {
      const errorDetail = data.errors?.[0]?.detail || 'Unknown error';
      const errorCode = data.errors?.[0]?.code || 'UNKNOWN';
      throw new Error(`Square API Error (${response.status}): ${errorCode} - ${errorDetail}`);
    }

    if (data.payment_link) {
      console.log('✅ Payment link created successfully!');
      return {
        id: data.payment_link.id,
        url: data.payment_link.url || data.payment_link.long_url,
      };
    } else {
      throw new Error('Checkout link creation failed: No payment_link in response');
    }
  } catch (error) {
    console.error('❌ [DEBUG] Error creating checkout link:', error.message);
    throw error;
  }
}

// Export square client and initialization status
export { squareClient, squareInitError };

