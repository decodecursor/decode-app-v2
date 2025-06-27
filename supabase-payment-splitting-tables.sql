-- Payment Splitting Tables for DECODE app
-- Advanced payment functionality with multiple recipient support

-- Payment Split Recipients Table
-- Defines who receives what percentage of payments for a payment link
CREATE TABLE payment_split_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_link_id UUID NOT NULL REFERENCES payment_links(id) ON DELETE CASCADE,
    recipient_user_id UUID REFERENCES users(id), -- For internal users
    recipient_email TEXT, -- For external recipients (non-platform users)
    recipient_name TEXT, -- Display name for external recipients
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('platform_user', 'external_email', 'platform_fee')),
    split_percentage DECIMAL(5,2) NOT NULL CHECK (split_percentage > 0 AND split_percentage <= 100),
    split_amount_fixed DECIMAL(10,2), -- Optional fixed amount instead of percentage
    split_type TEXT NOT NULL CHECK (split_type IN ('percentage', 'fixed_amount')) DEFAULT 'percentage',
    is_primary_recipient BOOLEAN DEFAULT false, -- The main creator/business owner
    notes TEXT, -- Optional notes about the split
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_recipient CHECK (
        (recipient_type = 'platform_user' AND recipient_user_id IS NOT NULL) OR
        (recipient_type = 'external_email' AND recipient_email IS NOT NULL) OR
        (recipient_type = 'platform_fee')
    ),
    CONSTRAINT valid_split_amount CHECK (
        (split_type = 'percentage' AND split_percentage IS NOT NULL) OR
        (split_type = 'fixed_amount' AND split_amount_fixed IS NOT NULL)
    )
);

-- Create indexes for performance
CREATE INDEX idx_payment_split_recipients_payment_link ON payment_split_recipients(payment_link_id);
CREATE INDEX idx_payment_split_recipients_user ON payment_split_recipients(recipient_user_id);
CREATE INDEX idx_payment_split_recipients_email ON payment_split_recipients(recipient_email);

-- Payment Split Transactions Table  
-- Records actual payment distributions for completed transactions
CREATE TABLE payment_split_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    split_recipient_id UUID NOT NULL REFERENCES payment_split_recipients(id),
    recipient_user_id UUID REFERENCES users(id),
    recipient_email TEXT,
    recipient_name TEXT,
    split_amount_usd DECIMAL(10,2) NOT NULL,
    split_percentage_applied DECIMAL(5,2), -- Actual percentage used
    distribution_status TEXT NOT NULL CHECK (distribution_status IN ('pending', 'processed', 'failed', 'cancelled')) DEFAULT 'pending',
    processor_transaction_id TEXT, -- External payment processor reference
    distribution_fee DECIMAL(10,2) DEFAULT 0, -- Fee for processing the split
    distribution_date TIMESTAMPTZ,
    failure_reason TEXT, -- If distribution failed
    metadata JSONB DEFAULT '{}', -- Additional data from payment processor
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_payment_split_transactions_transaction ON payment_split_transactions(transaction_id);
CREATE INDEX idx_payment_split_transactions_recipient ON payment_split_transactions(split_recipient_id);
CREATE INDEX idx_payment_split_transactions_status ON payment_split_transactions(distribution_status);
CREATE INDEX idx_payment_split_transactions_date ON payment_split_transactions(distribution_date);

-- Payment Split Templates Table
-- Reusable split configurations that users can apply to multiple payment links
CREATE TABLE payment_split_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, template_name)
);

-- Create index
CREATE INDEX idx_payment_split_templates_user ON payment_split_templates(user_id);

-- Payment Split Template Recipients Table
-- Recipients defined in templates
CREATE TABLE payment_split_template_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES payment_split_templates(id) ON DELETE CASCADE,
    recipient_user_id UUID REFERENCES users(id),
    recipient_email TEXT,
    recipient_name TEXT,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('platform_user', 'external_email', 'platform_fee')),
    split_percentage DECIMAL(5,2) NOT NULL CHECK (split_percentage > 0 AND split_percentage <= 100),
    split_amount_fixed DECIMAL(10,2),
    split_type TEXT NOT NULL CHECK (split_type IN ('percentage', 'fixed_amount')) DEFAULT 'percentage',
    is_primary_recipient BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Same constraints as payment_split_recipients
    CONSTRAINT valid_template_recipient CHECK (
        (recipient_type = 'platform_user' AND recipient_user_id IS NOT NULL) OR
        (recipient_type = 'external_email' AND recipient_email IS NOT NULL) OR
        (recipient_type = 'platform_fee')
    ),
    CONSTRAINT valid_template_split_amount CHECK (
        (split_type = 'percentage' AND split_percentage IS NOT NULL) OR
        (split_type = 'fixed_amount' AND split_amount_fixed IS NOT NULL)
    )
);

-- Create index
CREATE INDEX idx_payment_split_template_recipients_template ON payment_split_template_recipients(template_id);

-- Enable Row Level Security on all tables
ALTER TABLE payment_split_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_split_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_split_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_split_template_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_split_recipients
CREATE POLICY "Users can view split recipients for their payment links" ON payment_split_recipients
    FOR SELECT USING (
        payment_link_id IN (
            SELECT id FROM payment_links 
            WHERE creator_id::text = auth.uid()::text
        ) OR
        recipient_user_id::text = auth.uid()::text
    );

CREATE POLICY "Users can manage split recipients for their payment links" ON payment_split_recipients
    FOR ALL USING (
        payment_link_id IN (
            SELECT id FROM payment_links 
            WHERE creator_id::text = auth.uid()::text
        )
    );

-- RLS Policies for payment_split_transactions
CREATE POLICY "Users can view split transactions for their payments" ON payment_split_transactions
    FOR SELECT USING (
        transaction_id IN (
            SELECT t.id FROM transactions t
            JOIN payment_links pl ON t.payment_link_id = pl.id
            WHERE pl.creator_id::text = auth.uid()::text
        ) OR
        recipient_user_id::text = auth.uid()::text
    );

CREATE POLICY "System can manage split transactions" ON payment_split_transactions
    FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for payment_split_templates
CREATE POLICY "Users can manage their own split templates" ON payment_split_templates
    FOR ALL USING (user_id::text = auth.uid()::text);

-- RLS Policies for payment_split_template_recipients
CREATE POLICY "Users can manage their template recipients" ON payment_split_template_recipients
    FOR ALL USING (
        template_id IN (
            SELECT id FROM payment_split_templates 
            WHERE user_id::text = auth.uid()::text
        )
    );

-- Functions for split validation and processing

-- Function to validate split percentages total 100%
CREATE OR REPLACE FUNCTION validate_split_percentages()
RETURNS trigger AS $$
DECLARE
    total_percentage DECIMAL(5,2);
    payment_link_total DECIMAL(10,2);
    total_fixed_amounts DECIMAL(10,2);
BEGIN
    -- Get payment link amount
    SELECT amount_usd INTO payment_link_total
    FROM payment_links 
    WHERE id = NEW.payment_link_id;
    
    -- Calculate total percentage splits
    SELECT COALESCE(SUM(split_percentage), 0) INTO total_percentage
    FROM payment_split_recipients 
    WHERE payment_link_id = NEW.payment_link_id 
    AND split_type = 'percentage'
    AND id != COALESCE(OLD.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    -- Add current record if it's percentage
    IF NEW.split_type = 'percentage' THEN
        total_percentage := total_percentage + NEW.split_percentage;
    END IF;
    
    -- Calculate total fixed amounts
    SELECT COALESCE(SUM(split_amount_fixed), 0) INTO total_fixed_amounts
    FROM payment_split_recipients 
    WHERE payment_link_id = NEW.payment_link_id 
    AND split_type = 'fixed_amount'
    AND id != COALESCE(OLD.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    -- Add current record if it's fixed amount
    IF NEW.split_type = 'fixed_amount' THEN
        total_fixed_amounts := total_fixed_amounts + NEW.split_amount_fixed;
    END IF;
    
    -- Validate percentages don't exceed 100%
    IF total_percentage > 100 THEN
        RAISE EXCEPTION 'Total split percentages cannot exceed 100%%. Current total: %', total_percentage;
    END IF;
    
    -- Validate fixed amounts don't exceed payment amount
    IF total_fixed_amounts > payment_link_total THEN
        RAISE EXCEPTION 'Total fixed split amounts ($%) cannot exceed payment amount ($%)', total_fixed_amounts, payment_link_total;
    END IF;
    
    -- Validate combination of fixed and percentage doesn't exceed limits
    IF total_fixed_amounts > 0 AND total_percentage > 0 THEN
        -- Calculate remaining amount after fixed splits
        IF (payment_link_total - total_fixed_amounts) * (total_percentage / 100) + total_fixed_amounts > payment_link_total THEN
            RAISE EXCEPTION 'Combined fixed amounts and percentage splits exceed payment total';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create validation triggers
CREATE TRIGGER trigger_validate_split_percentages
    BEFORE INSERT OR UPDATE ON payment_split_recipients
    FOR EACH ROW
    EXECUTE FUNCTION validate_split_percentages();

-- Function to create split transactions when a payment is completed
CREATE OR REPLACE FUNCTION create_split_transactions()
RETURNS trigger AS $$
DECLARE
    split_recipient RECORD;
    split_amount DECIMAL(10,2);
    remaining_amount DECIMAL(10,2);
    total_percentage DECIMAL(5,2);
    total_fixed_amounts DECIMAL(10,2);
BEGIN
    -- Only process for completed transactions
    IF NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;
    
    -- Check if splits already created (prevent duplicates)
    IF EXISTS (
        SELECT 1 FROM payment_split_transactions 
        WHERE transaction_id = NEW.id
    ) THEN
        RETURN NEW;
    END IF;
    
    -- Calculate total fixed amounts
    SELECT COALESCE(SUM(split_amount_fixed), 0) INTO total_fixed_amounts
    FROM payment_split_recipients 
    WHERE payment_link_id = NEW.payment_link_id 
    AND split_type = 'fixed_amount';
    
    -- Calculate remaining amount for percentage splits
    remaining_amount := NEW.amount_paid_usd - total_fixed_amounts;
    
    -- Create split transactions for each recipient
    FOR split_recipient IN 
        SELECT * FROM payment_split_recipients 
        WHERE payment_link_id = NEW.payment_link_id
        ORDER BY is_primary_recipient DESC, created_at ASC
    LOOP
        -- Calculate split amount
        IF split_recipient.split_type = 'fixed_amount' THEN
            split_amount := split_recipient.split_amount_fixed;
        ELSE
            split_amount := remaining_amount * (split_recipient.split_percentage / 100);
        END IF;
        
        -- Insert split transaction record
        INSERT INTO payment_split_transactions (
            transaction_id,
            split_recipient_id,
            recipient_user_id,
            recipient_email,
            recipient_name,
            split_amount_usd,
            split_percentage_applied,
            distribution_status
        ) VALUES (
            NEW.id,
            split_recipient.id,
            split_recipient.recipient_user_id,
            split_recipient.recipient_email,
            split_recipient.recipient_name,
            split_amount,
            CASE 
                WHEN split_recipient.split_type = 'percentage' THEN split_recipient.split_percentage
                ELSE (split_amount / NEW.amount_paid_usd * 100)
            END,
            'pending'
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic split transaction creation
CREATE TRIGGER trigger_create_split_transactions
    AFTER INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION create_split_transactions();

-- Views for easier querying

-- View for payment link split summary
CREATE OR REPLACE VIEW payment_link_split_summary AS
SELECT 
    pl.id as payment_link_id,
    pl.title,
    pl.amount_usd,
    COUNT(psr.id) as recipient_count,
    SUM(CASE WHEN psr.split_type = 'percentage' THEN psr.split_percentage ELSE 0 END) as total_percentage,
    SUM(CASE WHEN psr.split_type = 'fixed_amount' THEN psr.split_amount_fixed ELSE 0 END) as total_fixed_amount,
    pl.amount_usd - COALESCE(SUM(CASE WHEN psr.split_type = 'fixed_amount' THEN psr.split_amount_fixed ELSE 0 END), 0) as remaining_for_percentage,
    COUNT(CASE WHEN psr.is_primary_recipient THEN 1 END) > 0 as has_primary_recipient
FROM payment_links pl
LEFT JOIN payment_split_recipients psr ON pl.id = psr.payment_link_id
GROUP BY pl.id, pl.title, pl.amount_usd;

-- View for transaction split summary
CREATE OR REPLACE VIEW transaction_split_summary AS
SELECT 
    t.id as transaction_id,
    t.amount_paid_usd,
    COUNT(pst.id) as split_count,
    SUM(pst.split_amount_usd) as total_split_amount,
    t.amount_paid_usd - COALESCE(SUM(pst.split_amount_usd), 0) as remaining_amount,
    COUNT(CASE WHEN pst.distribution_status = 'processed' THEN 1 END) as processed_splits,
    COUNT(CASE WHEN pst.distribution_status = 'pending' THEN 1 END) as pending_splits,
    COUNT(CASE WHEN pst.distribution_status = 'failed' THEN 1 END) as failed_splits
FROM transactions t
LEFT JOIN payment_split_transactions pst ON t.id = pst.transaction_id
WHERE t.status = 'completed'
GROUP BY t.id, t.amount_paid_usd;

-- Default platform fee configuration (can be customized per business model)
-- This would be managed through admin interface in production
INSERT INTO payment_split_templates (
    user_id, 
    template_name, 
    description, 
    is_default
) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, -- System template
    'DECODE Default Platform Fee',
    'Default 5% platform fee configuration',
    true
) ON CONFLICT DO NOTHING;

-- Helper function to apply template to payment link
CREATE OR REPLACE FUNCTION apply_split_template_to_payment_link(
    payment_link_id_param UUID,
    template_id_param UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    template_recipient RECORD;
BEGIN
    -- Verify template exists and user has access
    IF NOT EXISTS (
        SELECT 1 FROM payment_split_templates 
        WHERE id = template_id_param
    ) THEN
        RAISE EXCEPTION 'Split template not found';
    END IF;
    
    -- Clear existing recipients for this payment link
    DELETE FROM payment_split_recipients 
    WHERE payment_link_id = payment_link_id_param;
    
    -- Copy recipients from template
    FOR template_recipient IN 
        SELECT * FROM payment_split_template_recipients 
        WHERE template_id = template_id_param
    LOOP
        INSERT INTO payment_split_recipients (
            payment_link_id,
            recipient_user_id,
            recipient_email,
            recipient_name,
            recipient_type,
            split_percentage,
            split_amount_fixed,
            split_type,
            is_primary_recipient,
            notes
        ) VALUES (
            payment_link_id_param,
            template_recipient.recipient_user_id,
            template_recipient.recipient_email,
            template_recipient.recipient_name,
            template_recipient.recipient_type,
            template_recipient.split_percentage,
            template_recipient.split_amount_fixed,
            template_recipient.split_type,
            template_recipient.is_primary_recipient,
            template_recipient.notes
        );
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;