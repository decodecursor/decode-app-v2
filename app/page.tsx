import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4">DECODE</h1>
          <p className="text-xl text-gray-300 mb-8">Beauty Payment Platform</p>
          <p className="text-gray-400 mb-12 max-w-2xl mx-auto">
            Streamlined payment solutions for beauty professionals. Create payment links, 
            manage transactions, and grow your beauty business with ease.
          </p>
          
          <div className="space-y-4">
            <Link 
              href="/auth" 
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Get Started
            </Link>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Easy Setup</h3>
                <p className="text-gray-400">Create payment links in minutes</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Secure Payments</h3>
                <p className="text-gray-400">Bank-level security for all transactions</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Auto Revenue Split</h3>
                <p className="text-gray-400">Automatic commission distribution</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
