-- WhatsApp messages logging table for AUTHKEY integration
-- Tracks all outbound WhatsApp messages for delivery status and debugging

CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID REFERENCES bids(id) ON DELETE SET NULL,
  bidder_id UUID REFERENCES guest_bidders(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL,
  country_code VARCHAR(5) NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  template_wid VARCHAR(20) NOT NULL,
  template_data JSONB NOT NULL DEFAULT '{}',
  authkey_message_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  provider_response JSONB,
  webhook_payload JSONB,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for looking up messages by phone number (for webhook matching)
CREATE INDEX idx_whatsapp_messages_phone ON whatsapp_messages(phone);

-- Index for looking up messages by authkey message ID (for webhook matching)
CREATE INDEX idx_whatsapp_messages_authkey_id ON whatsapp_messages(authkey_message_id);

-- Index for looking up messages by bid
CREATE INDEX idx_whatsapp_messages_bid_id ON whatsapp_messages(bid_id);

-- Index for status queries
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);

-- Enable RLS
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access (internal logging table)
CREATE POLICY "Service role access only" ON whatsapp_messages
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE whatsapp_messages IS 'Logs all outbound WhatsApp messages sent via AUTHKEY BSP for tracking and webhook status updates';
