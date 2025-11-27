'use client';

import { useEffect } from 'react';

export default function useRazorpayScript() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Already loaded?
    if ((window as any).Razorpay) return;

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    // optional cleanup
    return () => {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);
}
