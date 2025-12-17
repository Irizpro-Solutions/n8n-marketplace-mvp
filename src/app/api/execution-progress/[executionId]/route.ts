// src/app/api/execution-progress/[executionId]/route.ts
import { NextRequest, NextResponse } from 'next/server'

// Store progress connections in memory
// In production, you'd want to use Redis or similar
const progressConnections = new Map<string, ReadableStreamDefaultController>()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params

  // Set up Server-Sent Events stream
  const encoder = new TextEncoder()
  
  const customReadable = new ReadableStream({
    start(controller) {
      // Store this controller for sending updates
      progressConnections.set(executionId, controller)
      
      // Send initial connection message
      const data = `data: ${JSON.stringify({ 
        message: 'Connected to execution progress stream',
        executionId,
        timestamp: new Date().toISOString()
      })}\n\n`
      
      controller.enqueue(encoder.encode(data))
    },
    cancel() {
      // Clean up when client disconnects
      progressConnections.delete(executionId)
    }
  })

  return new Response(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
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
    
    // Extract progress data from n8n
    const { 
      progress = 0, 
      status = 'processing', 
      message = '', 
      error = null,
      result = null
    } = body

    console.log(`Progress update for ${executionId}:`, { progress, status, message })

    // Find the SSE connection for this execution
    const controller = progressConnections.get(executionId)
    
    if (controller) {
      // Send progress update to the connected client
      const encoder = new TextEncoder()
      const progressData = {
        progress,
        status,
        message,
        error,
        result,
        executionId,
        timestamp: new Date().toISOString()
      }
      
      const data = `data: ${JSON.stringify(progressData)}\n\n`
      
      try {
        controller.enqueue(encoder.encode(data))
        
        // If execution is complete, close the connection
        if (status === 'completed' || status === 'error' || progress >= 100) {
          setTimeout(() => {
            controller.close()
            progressConnections.delete(executionId)
          }, 1000) // Small delay to ensure message is sent
        }
      } catch (streamError) {
        console.error('Error sending to stream:', streamError)
        // Clean up dead connection
        progressConnections.delete(executionId)
      }
    } else {
      console.log(`No active connection found for execution ${executionId}`)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Progress update received',
      executionId,
      connectionsActive: progressConnections.size
    })

  } catch (error) {
    console.error('Error handling progress update:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}