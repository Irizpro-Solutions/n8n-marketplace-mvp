import { NextApiRequest, NextApiResponse } from 'next'

// Add these type declarations
declare global {
  var progressConnections: Map<string, NextApiResponse> | undefined
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { executionId } = req.query as { executionId: string }

  if (req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    })

    // Initialize if not exists
    if (!global.progressConnections) {
      global.progressConnections = new Map()
    }
    
    global.progressConnections.set(executionId, res)

    req.on('close', () => {
      global.progressConnections?.delete(executionId)
    })

  } else if (req.method === 'POST') {
    const { progress, status, error } = req.body
    const connection = global.progressConnections?.get(executionId)
    
    if (connection) {
      connection.write(`data: ${JSON.stringify({ progress, status, error })}\n\n`)
    }
    
    res.status(200).json({ received: true })
  }
}