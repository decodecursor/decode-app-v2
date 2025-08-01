-- Create stored procedure for atomic payment completion
-- This ensures both transaction and payment_link status are updated together

CREATE OR REPLACE FUNCTION complete_stripe_payment(
    p_payment_link_id UUID,
    p_session_id TEXT,
    p_payment_intent_id TEXT,
    p_customer_email TEXT DEFAULT NULL,
    p_amount_total DECIMAL DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_transaction_id UUID;
    v_transaction_record RECORD;
    v_result JSON;
BEGIN
    -- Find the transaction by session ID and payment link ID
    SELECT * INTO v_transaction_record
    FROM transactions 
    WHERE payment_link_id = p_payment_link_id 
      AND processor_session_id = p_session_id 
      AND payment_processor = 'stripe'
      AND status = 'pending'
    LIMIT 1;
    
    -- If no transaction found, raise an error
    IF v_transaction_record IS NULL THEN
        RAISE EXCEPTION 'No pending transaction found for session % and payment link %', p_session_id, p_payment_link_id;
    END IF;
    
    v_transaction_id := v_transaction_record.id;
    
    -- Begin atomic update
    -- Update transaction status
    UPDATE transactions 
    SET 
        status = 'completed',
        processor_payment_id = p_payment_intent_id,
        processor_transaction_id = p_payment_intent_id,
        completed_at = NOW(),
        buyer_email = COALESCE(p_customer_email, buyer_email),
        amount_usd = COALESCE(p_amount_total, amount_usd),
        metadata = metadata || jsonb_build_object(
            'payment_completed_at', NOW()::text,
            'completion_method', 'stored_procedure',
            'session_data', jsonb_build_object(
                'session_id', p_session_id,
                'payment_intent_id', p_payment_intent_id,
                'customer_email', p_customer_email
            )
        )
    WHERE id = v_transaction_id;
    
    -- The payment_links status will be automatically updated by the trigger
    -- we created in the add-payment-status-to-payment-links.sql migration
    
    -- Build success response
    v_result := json_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'payment_link_id', p_payment_link_id,
        'session_id', p_session_id,
        'payment_intent_id', p_payment_intent_id,
        'completed_at', NOW()
    );
    
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE EXCEPTION 'Failed to complete payment: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION complete_stripe_payment TO authenticated, service_role;

-- Add comment for documentation
COMMENT ON FUNCTION complete_stripe_payment IS 'Atomically completes a Stripe payment by updating transaction status and triggering payment_link status update';