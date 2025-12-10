// DELETED - No longer needed for embedded checkout approach
// Embedded checkout handles payment processing directly in the React component
// No API calls needed for URL generation

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json({
    message: 'This endpoint is no longer needed. Payment processing is handled via embedded checkout.'
  }, { status: 200 });
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'This endpoint is no longer needed. Payment processing is handled via embedded checkout.'
  }, { status: 200 });
}