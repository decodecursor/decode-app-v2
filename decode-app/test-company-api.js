#!/usr/bin/env node

/**
 * Test script to verify the /api/users/company endpoint
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testCompanyData() {
  console.log('🔍 Testing simplified company data access...');

  try {
    // Test 1: Check admin users and their branch data
    console.log('\n1. Testing admin users and branch extraction...');

    // Test 2: Check admin users
    const { data: adminUsers, error: adminError } = await supabase
      .from('users')
      .select('id, email, user_name, company_name, branch_name, role')
      .eq('role', 'Admin')
      .limit(5);

    if (adminError) {
      console.error('❌ Admin users error:', adminError);
    } else {
      console.log('✅ Admin users found:', adminUsers?.length);
      adminUsers?.forEach(user => {
        console.log(`   - ${user.user_name} (${user.company_name}) - Branch: ${user.branch_name}`);
      });
    }

    // Test 3: Test the exact query the API uses for a specific company
    console.log('\n3. Testing company-specific queries...');

    if (adminUsers && adminUsers.length > 0) {
      const testCompany = adminUsers[0].company_name;
      console.log(`   Testing with company: ${testCompany}`);

      // Test company users query
      const { data: companyUsers, error: companyUsersError } = await supabase
        .from('users')
        .select('id, email, user_name, company_name, branch_name, role, approval_status, created_at')
        .eq('company_name', testCompany)
        .order('created_at', { ascending: false });

      if (companyUsersError) {
        console.error('❌ Company users error:', companyUsersError);
      } else {
        console.log(`✅ Company users for ${testCompany}:`, companyUsers?.length);
        companyUsers?.forEach(user => {
          console.log(`   - ${user.user_name} (${user.role}) - Branch: ${user.branch_name}`);
        });
      }

      // Test company branches query
      const { data: companyBranches, error: companyBranchesError } = await supabase
        .from('branches')
        .select('name')
        .eq('company_name', testCompany)
        .order('name');

      if (companyBranchesError) {
        console.error('❌ Company branches error:', companyBranchesError);
      } else {
        console.log(`✅ Company branches for ${testCompany}:`, companyBranches?.length);
        companyBranches?.forEach(branch => {
          console.log(`   - ${branch.name}`);
        });
      }
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testCompanyData()
  .then(() => {
    console.log('\n🎉 Company API test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });