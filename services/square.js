import pkg from 'square';
const { SquareClient, SquareEnvironment } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Initialize Square
let squareClient = null;
let squareInitError = null;

const accessToken = process.env.SQUARE_ACCESS_TOKEN || 'EAAAl7w2qKcRmOIDvAFbpB1KNOZlPP_PVW3p_zMF1TYeKIiX6cS9pYVWKHoLHiW-';
const applicationId = process.env.SQUARE_APPLICATION_ID || 'sandbox-sq0idb-UaHTFB2o4haHG5ZUmAL1Ag';
const environment = process.env.SQUARE_ENVIRONMENT || 'sandbox'; // 'sandbox' or 'production'
const locationIdOverride = process.env.SQUARE_LOCATION_ID; // Optional: set if API call fails

// Debug: Show token info
console.log('🔍 Square Debug Info:');
console.log('   Token from ENV:', process.env.SQUARE_ACCESS_TOKEN ? 'YES' : 'NO (using fallback)');
console.log('   Token starts with:', accessToken.substring(0, 10) + '...');
console.log('   Token ends with:', '...' + accessToken.substring(accessToken.length - 10));
console.log('   Token length:', accessToken.length);

if (accessToken && applicationId) {
  try {
    console.log('🔍 [DEBUG] Initializing Square Client:');
    console.log('   Access token length:', accessToken.length);
    console.log('   Access token starts with:', accessToken.substring(0, 15));
    console.log('   Access token ends with:', accessToken.substring(accessToken.length - 15));
    console.log('   Application ID:', applicationId);
    console.log('   Environment:', environment);
    console.log('   SquareEnvironment.Sandbox:', SquareEnvironment.Sandbox);
    console.log('   SquareEnvironment.Production:', SquareEnvironment.Production);

    squareClient = new SquareClient({
      accessToken: accessToken,
      environment: environment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
    });

    console.log('✅ Square initialized successfully');
    console.log('   Environment:', environment);
    console.log('   Application ID:', applicationId.substring(0, 20) + '...');
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
  const token = process.env.SQUARE_ACCESS_TOKEN || 'EAAAl9UEyMZ8UQ0EuKqWOkS4rt_vgJ5H7H9CBHruBXSnDOBtcu53FmG_z7ji1vP7';
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
 * @param {Array} lineItems - Array of line items for the checkout
 * @param {string} successUrl - URL to redirect on success
 * @param {string} cancelUrl - URL to redirect on cancel
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Checkout link
 */
export async function createCheckoutLink(lineItems, successUrl, cancelUrl, metadata = {}) {
  if (!squareClient) {
    const errorMsg = squareInitError
      ? `Square is not configured: ${squareInitError}`
      : 'Square is not configured. Please set SQUARE_ACCESS_TOKEN and SQUARE_APPLICATION_ID.';
    throw new Error(errorMsg);
  }

  try {
    console.log('🔍 [DEBUG] createCheckoutLink - Starting:');
    console.log('   Line items count:', lineItems.length);
    console.log('   Success URL:', successUrl);
    console.log('   Cancel URL:', cancelUrl);
    console.log('   Metadata:', JSON.stringify(metadata, null, 2));

    const locationId = await getLocationId();
    console.log('🔍 [DEBUG] Location ID obtained:', locationId);

    // Convert line items to Square format
    const squareLineItems = lineItems.map(item => ({
      name: item.name || 'Item',
      quantity: item.quantity?.toString() || '1',
      basePriceMoney: {
        amount: Math.round((item.amount || item.price || 0) * 100), // Convert to cents
        currency: 'EUR',
      },
    }));

    console.log('🔍 [DEBUG] Square line items:', JSON.stringify(squareLineItems, null, 2));

    const totalAmount = Math.round(lineItems.reduce((sum, item) => sum + (item.amount || item.price || 0), 0) * 100);
    console.log('🔍 [DEBUG] Total amount (cents):', totalAmount);

    // Convert amounts to BigInt (required by Square SDK)
    const squareLineItemsWithBigInt = squareLineItems.map(item => ({
      ...item,
      basePriceMoney: {
        ...item.basePriceMoney,
        amount: BigInt(item.basePriceMoney.amount),
      },
    }));

    const paymentLinkRequest = {
      idempotencyKey: `checkout-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      quickPay: {
        name: metadata.name || 'Order',
        locationId: locationId, // Required for quickPay
        priceMoney: {
          amount: BigInt(totalAmount), // Must be BigInt
          currency: 'EUR',
        },
      },
      checkoutOptions: {
        redirectUrl: successUrl,
        askForShippingAddress: true,
      },
      prePopulatedData: {
        buyerEmail: metadata.email || undefined,
        buyerPhoneNumber: metadata.phone || undefined,
      },
      order: {
        locationId: locationId,
        lineItems: squareLineItemsWithBigInt,
      },
    };

    // Custom serializer for BigInt values in debug log
    const debugRequest = JSON.parse(JSON.stringify(paymentLinkRequest, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
    console.log('🔍 [DEBUG] Payment link request:', JSON.stringify(debugRequest, null, 2));
    console.log('🔍 [DEBUG] Calling squareClient.checkout.paymentLinks.create()...');

    const response = await squareClient.checkout.paymentLinks.create(paymentLinkRequest);

    if (response.result && response.result.paymentLink) {
      return {
        id: response.result.paymentLink.id,
        url: response.result.paymentLink.url || response.result.paymentLink.longUrl,
      };
    } else {
      throw new Error('Checkout link creation failed: ' + JSON.stringify(response.errors || 'Unknown error'));
    }
  } catch (error) {
    console.error('❌ [DEBUG] Error creating checkout link - Full Details:');
    console.error('   Error type:', error.constructor.name);
    console.error('   Error message:', error.message);
    console.error('   Status code:', error.statusCode);
    console.error('   Error category:', error.errors?.[0]?.category);
    console.error('   Error code:', error.errors?.[0]?.code);
    console.error('   Error detail:', error.errors?.[0]?.detail);
    console.error('   Error field:', error.errors?.[0]?.field);
    console.error('   Full error object:', JSON.stringify({
      statusCode: error.statusCode,
      errors: error.errors,
      body: error.body,
      url: error.rawResponse?.url,
      method: error.rawResponse?.method,
      headers: Object.fromEntries(error.rawResponse?.headers || [])
    }, null, 2));

    // Provide more detailed error information
    if (error.errors && error.errors.length > 0) {
      const errorDetails = error.errors.map(e => `${e.code}: ${e.detail}${e.field ? ` (field: ${e.field})` : ''}`).join(', ');
      throw new Error(`Square API Error: ${errorDetails}`);
    }
    if (error.statusCode === 401) {
      console.error('❌ [DEBUG] 401 Unauthorized - Authentication failed');
      console.error('   This usually means:');
      console.error('   1. Token is invalid, expired, or revoked');
      console.error('   2. Token missing required OAuth scopes/permissions');
      console.error('   3. Token is for wrong environment');
      console.error('   4. Application not properly activated in Square Dashboard');
      throw new Error('Square authentication failed. Please check your SQUARE_ACCESS_TOKEN is valid and has not expired.');
    }
    throw error;
  }
}

// Export square client and initialization status
export { squareClient, squareInitError };

