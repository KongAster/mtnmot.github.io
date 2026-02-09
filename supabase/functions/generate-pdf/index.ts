
// supabase/functions/generate-pdf/index.ts

// Declare Deno for the edge runtime environment
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-auth, x-supabase-functions-jwt, prefer, content-length, x-payload-type, x-file-name',
  'Access-Control-Max-Age': '86400',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405
    })
  }

  try {
    let html = '';
    let fileName = 'report.pdf';

    const payloadType = req.headers.get('X-Payload-Type');
    
    // Support Gzip Binary Stream for Large Documents
    if (payloadType === 'gzip-html') {
      console.log("[PDF Generator]: Decompressing High-Precision Data Stream...");
      
      if (!req.body) throw new Error("Request payload is missing body");

      try {
          // ใช้ native decompression stream
          const decompressedStream = req.body.pipeThrough(new window.DecompressionStream('gzip'));
          html = await new Response(decompressedStream).text();
          
          const rawName = req.headers.get('X-File-Name');
          if (rawName) fileName = decodeURIComponent(rawName);
      } catch (decompressErr) {
          console.error("[Decompress Fatal]:", decompressErr);
          throw new Error("Data corruption during transfer: Unable to decompress Gzip payload");
      }
    } else {
      // Standard JSON Flow
      const body = await req.json();
      html = body.html;
      fileName = body.fileName || 'report.pdf';
    }

    if (!html || html.length < 100) {
      throw new Error('Incomplete HTML document data provided');
    }

    const BROWSERLESS_TOKEN = Deno.env.get('BROWSERLESS_TOKEN');
    if (!BROWSERLESS_TOKEN) {
      throw new Error('Server configuration error: Missing BROWSERLESS_TOKEN');
    }

    console.log(`[PDF Generator]: Rendering Document (${Math.round(html.length/1024)} KB)...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 115000); // Extended timeout to 115s

    try {
      const response = await fetch(`https://chrome.browserless.io/pdf?token=${BROWSERLESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ 
          html: html, 
          options: { 
            format: 'A4', 
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
            displayHeaderFooter: false,
            preferCSSPageSize: true,
            scale: 1, // Precision scale at browser level
            waitForSelector: 'body'
          } 
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Browserless API Error]: ${response.status} - ${errorText}`);
        throw new Error(`PDF Engine Error: ${response.status} - Please try using 'Local PDF'`);
      }

      const pdfBuffer = await response.arrayBuffer();
      console.log(`[PDF Generator]: Final Render Success (${Math.round(pdfBuffer.byteLength/1024)} KB)`);

      return new Response(pdfBuffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-cache'
        },
        status: 200,
      });

    } catch (fetchErr: any) {
      if (fetchErr.name === 'AbortError') {
        throw new Error('การประมวลผลบนเซิร์ฟเวอร์ใช้เวลานานเกินไป (Timeout) กรุณาลดจำนวนหน้าในรายงาน');
      }
      throw fetchErr;
    }

  } catch (error: any) {
    console.error("[Fatal Error]:", error.message);
    return new Response(JSON.stringify({ 
      error: 'PDF_GEN_FAILED',
      message: error.message || 'Internal Server Error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
