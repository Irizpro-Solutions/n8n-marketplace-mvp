// Updated src/app/api/execution-progress/[executionId]/route.ts
// This version fixes the CORS issues

import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory store for SSE connections
const progressConnections = new Map<string, ReadableStreamDefaultController>()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params
  console.log(`SSE connection requested for execution: ${executionId}`)

  const encoder = new TextEncoder()
  
  const customReadable = new ReadableStream({
    start(controller) {
      console.log(`Storing SSE controller for execution: ${executionId}`)
      progressConnections.set(executionId, controller)
      
      // Send connection confirmation
      const data = `data: ${JSON.stringify({ 
        message: 'Progress stream connected',
        executionId,
        progress: 0,
        status: 'connected'
      })}\n\n`
      
      controller.enqueue(encoder.encode(data))
    },
    cancel() {
      console.log(`SSE connection closed for execution: ${executionId}`)
      progressConnections.delete(executionId)
    }
  })

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
    },
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params
    const body = await request.json()
    
    console.log(`📊 Progress update received for ${executionId}:`, body)

    const { 
      progress = 0, 
      status = 'processing', 
      message = '',
      error = null,
      result = null
    } = body

    // Find the SSE connection
    const controller = progressConnections.get(executionId)
    
    if (controller) {
      console.log(`✅ Sending progress to UI: ${progress}% - ${status}`)
      
      const encoder = new TextEncoder()
      const progressData = {
        progress: Number(progress),
        status,
        message: message || status,
        error,
        result,
        executionId,
        timestamp: new Date().toISOString()
      }
      
      const data = `data: ${JSON.stringify(progressData)}\n\n`
      
      try {
        controller.enqueue(encoder.encode(data))
        
        // Close connection when complete
        if (status === 'completed' || status === 'error' || progress >= 100) {
          console.log(`🏁 Execution ${executionId} completed, closing connection`)
          setTimeout(() => {
            try {
              controller.close()
            } catch (e) {
              console.log('Controller already closed')
            }
            progressConnections.delete(executionId)
          }, 2000)
        }
        
      } catch (streamError) {
        console.error('❌ Error sending to SSE stream:', streamError)
        progressConnections.delete(executionId)
      }
    } else {
      console.log(`⚠️ No SSE connection found for execution ${executionId}`)
      console.log(`Active connections: ${Array.from(progressConnections.keys()).join(', ')}`)
    }

    // Return response with CORS headers
    return new NextResponse(JSON.stringify({ 
      success: true, 
      message: 'Progress update processed',
      executionId,
      activeConnections: progressConnections.size,
      connectionExists: !!controller
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
      },
    })

  } catch (error) {
    console.error('❌ Error in progress POST handler:', error)
    
    return new NextResponse(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
      },
    })
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
    },
  })
}