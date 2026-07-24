"use client";

import { useEffect, useState } from "react";

declare global { interface Window { google?: { accounts: { id: { initialize(options:Record<string,unknown>):void; renderButton(element:HTMLElement, options:Record<string,unknown>):void } } } } }

export default function LoginPage() {
  const [error, setError] = useState("");
  const [clientId,setClientId]=useState("");
  const [configLoading,setConfigLoading]=useState(true);
  useEffect(()=>{fetch("/api/auth/config").then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error);setClientId(data.googleClientId);}).catch(error=>setError(error.message||"Google login configuration required.")).finally(()=>setConfigLoading(false));},[]);
  useEffect(() => {
    if (!clientId) return;
    const initialize = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }:{credential:string}) => {
          setError("");
          const response = await fetch("/api/auth/google", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({credential}) });
          const data = await response.json();
          if (!response.ok) { setError(data.error || "Login failed."); return; }
          window.location.assign("/");
        },
      });
      const target = document.getElementById("google-signin");
      if (target) window.google.accounts.id.renderButton(target, { theme:"outline", size:"large", width:320, text:"continue_with" });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) { existing.addEventListener("load", initialize); initialize(); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true; script.defer = true; script.onload = initialize;
    document.head.appendChild(script);
  }, [clientId]);
  return <main className="login-page"><section className="login-card"><img src="/solutions-optispace-logo.png" alt="Solutions Optispace" /><span className="eyebrow">SECURE CRM ACCESS</span><h1>Welcome to Solutions Optispace CRM</h1><p>Sign in using an email approved by your CRM administrator.</p>{configLoading?<div className="login-config"><b>Loading secure login…</b><span>Reading the production identity configuration.</span></div>:clientId?<div id="google-signin" className="google-signin" />:<div className="login-config"><b>Google login configuration required</b><span>Add GOOGLE_CLIENT_ID to the Worker runtime variables and deploy the change.</span></div>}{error&&<div className="login-error">{error}</div>}<small>Google verifies your identity. Solutions Optispace never receives or stores your Gmail password.</small></section></main>;
}
