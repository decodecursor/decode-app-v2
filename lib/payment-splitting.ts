import { supabase } from './supabase'

export interface SplitRecipient {
  id?: string
  paymentLinkId?: string
  recipientUserId?: string
  recipientEmail?: string
  recipientName?: string
  recipientType: 'platform_user' | 'external_email' | 'platform_fee'
  splitPercentage?: number
  splitAmountFixed?: number
  splitType: 'percentage' | 'fixed_amount'
  isPrimaryRecipient?: boolean
  notes?: string
}

export interface SplitTemplate {
  id?: string
  userId: string
  templateName: string
  description?: string
  isDefault?: boolean
  recipients: SplitRecipient[]
}

export interface SplitTransaction {
  id: string
  transactionId: string
  splitRecipientId: string
  recipientUserId?: string
  recipientEmail?: string
  recipientName?: string
  splitAmountUsd: number
  splitPercentageApplied?: number
  distributionStatus: 'pending' | 'processed' | 'failed' | 'cancelled'
  processorTransactionId?: string
  distributionFee?: number
  distributionDate?: string
  failureReason?: string
  metadata?: any
}

export interface PaymentLinkSplitSummary {
  paymentLinkId: string
  title: string
  amountUsd: number
  recipientCount: number
  totalPercentage: number
  totalFixedAmount: number
  remainingForPercentage: number
  hasPrimaryRecipient: boolean
}

export interface TransactionSplitSummary {
  transactionId: string
  amountPaidUsd: number
  splitCount: number
  totalSplitAmount: number
  remainingAmount: number
  processedSplits: number
  pendingSplits: number
  failedSplits: number
}

/**
 * Add split recipients to a payment link
 */
export async function addSplitRecipients(paymentLinkId: string, recipients: SplitRecipient[]): Promise<void> {
  try {
    // Validate recipients
    validateSplitRecipients(recipients)
    
    // Prepare recipients data for insertion
    const recipientsData = recipients.map(recipient => ({
      payment_link_id: paymentLinkId,
      recipient_user_id: recipient.recipientUserId || null,
      recipient_email: recipient.recipientEmail || null,
      recipient_name: recipient.recipientName || null,
      recipient_type: recipient.recipientType,
      split_percentage: recipient.splitPercentage || null,
      split_amount_fixed: recipient.splitAmountFixed || null,
      split_type: recipient.splitType,
      is_primary_recipient: recipient.isPrimaryRecipient || false,
      notes: recipient.notes || null
    }))
    
    const { error } = await supabase
      .from('payment_split_recipients')
      .insert(recipientsData)
    
    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Error adding split recipients:', error)
    throw error
  }
}

/**
 * Update split recipients for a payment link
 */
export async function updateSplitRecipients(paymentLinkId: string, recipients: SplitRecipient[]): Promise<void> {
  try {
    // Validate recipients
    validateSplitRecipients(recipients)
    
    // Delete existing recipients
    await supabase
      .from('payment_split_recipients')
      .delete()
      .eq('payment_link_id', paymentLinkId)
    
    // Add new recipients
    if (recipients.length > 0) {
      await addSplitRecipients(paymentLinkId, recipients)
    }
  } catch (error) {
    console.error('Error updating split recipients:', error)
    throw error
  }
}

/**
 * Get split recipients for a payment link
 */
export async function getSplitRecipients(paymentLinkId: string): Promise<SplitRecipient[]> {
  try {
    const { data, error } = await supabase
      .from('payment_split_recipients')
      .select(`
        *,
        recipient_user:users!recipient_user_id (
          id,
          email,
          full_name
        )
      `)
      .eq('payment_link_id', paymentLinkId)
      .order('is_primary_recipient', { ascending: false })
      .order('created_at', { ascending: true })
    
    if (error) {
      throw error
    }
    
    return (data || []).map(item => ({
      id: item.id,
      paymentLinkId: item.payment_link_id,
      recipientUserId: item.recipient_user_id,
      recipientEmail: item.recipient_email,
      recipientName: item.recipient_name,
      recipientType: item.recipient_type,
      splitPercentage: item.split_percentage,
      splitAmountFixed: item.split_amount_fixed,
      splitType: item.split_type,
      isPrimaryRecipient: item.is_primary_recipient,
      notes: item.notes
    }))
  } catch (error) {
    console.error('Error fetching split recipients:', error)
    throw error
  }
}

/**
 * Validate split recipients configuration
 */
export function validateSplitRecipients(recipients: SplitRecipient[]): void {
  if (recipients.length === 0) {
    return // No recipients is valid (simple payment)
  }
  
  let totalPercentage = 0
  let totalFixedAmount = 0
  let primaryRecipientCount = 0
  
  recipients.forEach((recipient, index) => {
    // Validate recipient type and contact info
    if (recipient.recipientType === 'platform_user' && !recipient.recipientUserId) {
      throw new Error(`Recipient ${index + 1}: Platform user must have recipientUserId`)
    }
    
    if (recipient.recipientType === 'external_email' && !recipient.recipientEmail) {
      throw new Error(`Recipient ${index + 1}: External email recipient must have recipientEmail`)
    }
    
    // Validate split amounts
    if (recipient.splitType === 'percentage') {
      if (!recipient.splitPercentage || recipient.splitPercentage <= 0 || recipient.splitPercentage > 100) {
        throw new Error(`Recipient ${index + 1}: Invalid percentage (${recipient.splitPercentage})`)
      }
      totalPercentage += recipient.splitPercentage
    } else if (recipient.splitType === 'fixed_amount') {
      if (!recipient.splitAmountFixed || recipient.splitAmountFixed <= 0) {
        throw new Error(`Recipient ${index + 1}: Invalid fixed amount (${recipient.splitAmountFixed})`)
      }
      totalFixedAmount += recipient.splitAmountFixed
    }
    
    // Count primary recipients
    if (recipient.isPrimaryRecipient) {
      primaryRecipientCount++
    }
  })
  
  // Validate percentages don't exceed 100%
  if (totalPercentage > 100) {
    throw new Error(`Total split percentages (${totalPercentage}%) cannot exceed 100%`)
  }
  
  // Validate only one primary recipient
  if (primaryRecipientCount > 1) {
    throw new Error('Only one recipient can be marked as primary')
  }
}

/**
 * Calculate split amounts for a given payment amount
 */
export function calculateSplitAmounts(recipients: SplitRecipient[], paymentAmount: number): { recipient: SplitRecipient; amount: number; percentage: number }[] {
  if (recipients.length === 0) {
    return []
  }
  
  let remainingAmount = paymentAmount
  const results: { recipient: SplitRecipient; amount: number; percentage: number }[] = []
  
  // First, process fixed amounts
  recipients
    .filter(r => r.splitType === 'fixed_amount')
    .forEach(recipient => {
      const amount = Math.min(recipient.splitAmountFixed || 0, remainingAmount)
      const percentage = paymentAmount > 0 ? (amount / paymentAmount) * 100 : 0
      
      results.push({
        recipient,
        amount,
        percentage
      })
      
      remainingAmount -= amount
    })
  
  // Then, process percentage amounts from remaining
  recipients
    .filter(r => r.splitType === 'percentage')
    .forEach(recipient => {
      const amount = remainingAmount * ((recipient.splitPercentage || 0) / 100)
      const percentage = recipient.splitPercentage || 0
      
      results.push({
        recipient,
        amount,
        percentage
      })
    })
  
  return results
}

/**
 * Create or update split template
 */
export async function saveSplitTemplate(template: SplitTemplate): Promise<string> {
  try {
    let templateId = template.id
    
    if (templateId) {
      // Update existing template
      const { error: templateError } = await supabase
        .from('payment_split_templates')
        .update({
          template_name: template.templateName,
          description: template.description,
          is_default: template.isDefault,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)
      
      if (templateError) {
        throw templateError
      }
      
      // Delete existing template recipients
      await supabase
        .from('payment_split_template_recipients')
        .delete()
        .eq('template_id', templateId)
    } else {
      // Create new template
      const { data: templateData, error: templateError } = await supabase
        .from('payment_split_templates')
        .insert({
          user_id: template.userId,
          template_name: template.templateName,
          description: template.description,
          is_default: template.isDefault
        })
        .select()
        .single()
      
      if (templateError) {
        throw templateError
      }
      
      templateId = templateData.id!
    }
    
    // Add template recipients
    if (template.recipients.length > 0) {
      const recipientsData = template.recipients.map(recipient => ({
        template_id: templateId,
        recipient_user_id: recipient.recipientUserId || null,
        recipient_email: recipient.recipientEmail || null,
        recipient_name: recipient.recipientName || null,
        recipient_type: recipient.recipientType,
        split_percentage: recipient.splitPercentage || null,
        split_amount_fixed: recipient.splitAmountFixed || null,
        split_type: recipient.splitType,
        is_primary_recipient: recipient.isPrimaryRecipient || false,
        notes: recipient.notes || null
      }))
      
      const { error: recipientsError } = await supabase
        .from('payment_split_template_recipients')
        .insert(recipientsData)
      
      if (recipientsError) {
        throw recipientsError
      }
    }
    
    if (!templateId) {
      throw new Error('Failed to create or update template - no template ID available')
    }
    
    return templateId
  } catch (error) {
    console.error('Error saving split template:', error)
    throw error
  }
}

/**
 * Get split templates for a user
 */
export async function getSplitTemplates(userId: string): Promise<SplitTemplate[]> {
  try {
    const { data: templates, error: templatesError } = await supabase
      .from('payment_split_templates')
      .select(`
        *,
        recipients:payment_split_template_recipients (*)
      `)
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('template_name', { ascending: true })
    
    if (templatesError) {
      throw templatesError
    }
    
    return (templates || []).map(template => ({
      id: template.id,
      userId: template.user_id,
      templateName: template.template_name,
      description: template.description,
      isDefault: template.is_default,
      recipients: (template.recipients || []).map((recipient: any) => ({
        recipientUserId: recipient.recipient_user_id,
        recipientEmail: recipient.recipient_email,
        recipientName: recipient.recipient_name,
        recipientType: recipient.recipient_type,
        splitPercentage: recipient.split_percentage,
        splitAmountFixed: recipient.split_amount_fixed,
        splitType: recipient.split_type,
        isPrimaryRecipient: recipient.is_primary_recipient,
        notes: recipient.notes
      }))
    }))
  } catch (error) {
    console.error('Error fetching split templates:', error)
    throw error
  }
}

/**
 * Apply split template to payment link
 */
export async function applySplitTemplate(paymentLinkId: string, templateId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('apply_split_template_to_payment_link', {
      payment_link_id_param: paymentLinkId,
      template_id_param: templateId
    })
    
    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Error applying split template:', error)
    throw error
  }
}

/**
 * Get payment link split summary
 */
export async function getPaymentLinkSplitSummary(paymentLinkId: string): Promise<PaymentLinkSplitSummary | null> {
  try {
    const { data, error } = await supabase
      .from('payment_link_split_summary')
      .select('*')
      .eq('payment_link_id', paymentLinkId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null // No split summary found
      }
      throw error
    }
    
    return {
      paymentLinkId: data.payment_link_id,
      title: data.title,
      amountUsd: data.amount_usd,
      recipientCount: data.recipient_count,
      totalPercentage: data.total_percentage,
      totalFixedAmount: data.total_fixed_amount,
      remainingForPercentage: data.remaining_for_percentage,
      hasPrimaryRecipient: data.has_primary_recipient
    }
  } catch (error) {
    console.error('Error fetching payment link split summary:', error)
    throw error
  }
}

/**
 * Get split transactions for a transaction
 */
export async function getSplitTransactions(transactionId: string): Promise<SplitTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('payment_split_transactions')
      .select('*')
      .eq('transaction_id', transactionId)
      .order('split_amount_usd', { ascending: false })
    
    if (error) {
      throw error
    }
    
    return (data || []).map(item => ({
      id: item.id,
      transactionId: item.transaction_id,
      splitRecipientId: item.split_recipient_id,
      recipientUserId: item.recipient_user_id,
      recipientEmail: item.recipient_email,
      recipientName: item.recipient_name,
      splitAmountUsd: item.split_amount_usd,
      splitPercentageApplied: item.split_percentage_applied,
      distributionStatus: item.distribution_status,
      processorTransactionId: item.processor_transaction_id,
      distributionFee: item.distribution_fee,
      distributionDate: item.distribution_date,
      failureReason: item.failure_reason,
      metadata: item.metadata
    }))
  } catch (error) {
    console.error('Error fetching split transactions:', error)
    throw error
  }
}

/**
 * Get transaction split summary
 */
export async function getTransactionSplitSummary(transactionId: string): Promise<TransactionSplitSummary | null> {
  try {
    const { data, error } = await supabase
      .from('transaction_split_summary')
      .select('*')
      .eq('transaction_id', transactionId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null // No split summary found
      }
      throw error
    }
    
    return {
      transactionId: data.transaction_id,
      amountPaidUsd: data.amount_aed, // Note: This is AED but kept as USD for backward compatibility
      splitCount: data.split_count,
      totalSplitAmount: data.total_split_amount,
      remainingAmount: data.remaining_amount,
      processedSplits: data.processed_splits,
      pendingSplits: data.pending_splits,
      failedSplits: data.failed_splits
    }
  } catch (error) {
    console.error('Error fetching transaction split summary:', error)
    throw error
  }
}

/**
 * Update split transaction status (for payment processor integration)
 */
export async function updateSplitTransactionStatus(
  splitTransactionId: string, 
  status: 'pending' | 'processed' | 'failed' | 'cancelled',
  processorTransactionId?: string,
  distributionFee?: number,
  failureReason?: string,
  metadata?: any
): Promise<void> {
  try {
    const updateData: any = {
      distribution_status: status,
      updated_at: new Date().toISOString()
    }
    
    if (status === 'processed') {
      updateData.distribution_date = new Date().toISOString()
    }
    
    if (processorTransactionId) {
      updateData.processor_transaction_id = processorTransactionId
    }
    
    if (distributionFee !== undefined) {
      updateData.distribution_fee = distributionFee
    }
    
    if (failureReason) {
      updateData.failure_reason = failureReason
    }
    
    if (metadata) {
      updateData.metadata = metadata
    }
    
    const { error } = await supabase
      .from('payment_split_transactions')
      .update(updateData)
      .eq('id', splitTransactionId)
    
    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Error updating split transaction status:', error)
    throw error
  }
}

/**
 * Get user earnings (split transactions where they are the recipient)
 */
export async function getUserEarnings(userId: string, startDate?: Date, endDate?: Date): Promise<{
  totalEarnings: number
  totalSplits: number
  pendingEarnings: number
  processedEarnings: number
  recentSplits: SplitTransaction[]
}> {
  try {
    let query = supabase
      .from('payment_split_transactions')
      .select(`
        *,
        transaction:transactions!transaction_id (
          amount_aed,
          created_at,
          payment_link:payment_links!payment_link_id (
            title,
            creator:users!creator_id (
              full_name,
              email
            )
          )
        )
      `)
      .eq('recipient_user_id', userId)
    
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString())
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString())
    }
    
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) {
      throw error
    }
    
    const splits = data || []
    
    const totalEarnings = splits.reduce((sum, split) => sum + (split.split_amount_usd || 0), 0)
    const totalSplits = splits.length
    const pendingEarnings = splits
      .filter(split => split.distribution_status === 'pending')
      .reduce((sum, split) => sum + (split.split_amount_usd || 0), 0)
    const processedEarnings = splits
      .filter(split => split.distribution_status === 'processed')
      .reduce((sum, split) => sum + (split.split_amount_usd || 0), 0)
    
    const recentSplits = splits.slice(0, 10).map(item => ({
      id: item.id,
      transactionId: item.transaction_id,
      splitRecipientId: item.split_recipient_id,
      recipientUserId: item.recipient_user_id,
      recipientEmail: item.recipient_email,
      recipientName: item.recipient_name,
      splitAmountUsd: item.split_amount_usd,
      splitPercentageApplied: item.split_percentage_applied,
      distributionStatus: item.distribution_status,
      processorTransactionId: item.processor_transaction_id,
      distributionFee: item.distribution_fee,
      distributionDate: item.distribution_date,
      failureReason: item.failure_reason,
      metadata: item.metadata
    }))
    
    return {
      totalEarnings,
      totalSplits,
      pendingEarnings,
      processedEarnings,
      recentSplits
    }
  } catch (error) {
    console.error('Error fetching user earnings:', error)
    throw error
  }
}