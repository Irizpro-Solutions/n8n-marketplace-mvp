import Link from 'next/link';

export default function ModernFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-950/80 backdrop-blur-md border-t border-white/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <h3 className="font-semibold text-white mb-4">AI Agent Marketplace</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Powered by Irizpro. Execute AI-powered workflow agents with a simple credit-based system.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/browse" className="text-gray-400 hover:text-cyan-400 transition-colors">
                  Browse Agents
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-gray-400 hover:text-cyan-400 transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/credits" className="text-gray-400 hover:text-cyan-400 transition-colors">
                  Purchase Credits
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-white mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy-policy" className="text-gray-400 hover:text-cyan-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-400 hover:text-cyan-400 transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="text-gray-400 hover:text-cyan-400 transition-colors">
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold text-white mb-4">Contact</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/contact" className="hover:text-cyan-400 transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <a href="mailto:nidhi@irizpro.in" className="hover:text-cyan-400 transition-colors">
                  nidhi@irizpro.in
                </a>
              </li>
              <li>
                <a href="tel:+919370754234" className="hover:text-cyan-400 transition-colors">
                  +91-9370754234
                </a>
              </li>
              <li className="text-xs text-gray-500 pt-2">
                Mon-Fri, 10 AM - 6 PM IST
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400">
            © {currentYear} Irizpro. All rights reserved.
          </p>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Pune, Maharashtra, India</span>
            <span className="hidden md:inline">•</span>
            <span>Secure payments by Razorpay</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
