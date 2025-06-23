import Link from 'next/link'

export default function Home() {
  return (
    <div className="cosmic-bg">
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <div className="cosmic-card text-center">
          <h1 className="cosmic-logo mb-6">DECODE</h1>
          <p className="cosmic-heading mb-8">Beauty Payment Platform</p>
          <p className="cosmic-body mb-8 opacity-80">
            Streamlined payment solutions for beauty professionals. Create payment links, 
            manage transactions, and grow your beauty business with ease.
          </p>
          
          <div className="space-y-6">
            <Link 
              href="/auth" 
              className="cosmic-button-primary"
            >
              Get Started
            </Link>
            
            <div className="mt-8 space-y-4">
              <div className="cosmic-card border border-white/10 p-4">
                <h3 className="cosmic-label font-medium mb-2 text-white">Easy Setup</h3>
                <p className="cosmic-body text-sm opacity-70">Create payment links in minutes</p>
              </div>
              <div className="cosmic-card border border-white/10 p-4">
                <h3 className="cosmic-label font-medium mb-2 text-white">Secure Payments</h3>
                <p className="cosmic-body text-sm opacity-70">Bank-level security for all transactions</p>
              </div>
              <div className="cosmic-card border border-white/10 p-4">
                <h3 className="cosmic-label font-medium mb-2 text-white">Auto Revenue Split</h3>
                <p className="cosmic-body text-sm opacity-70">Automatic commission distribution</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
