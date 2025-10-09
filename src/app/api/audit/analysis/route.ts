import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const analysisPath = path.join(process.cwd(), 'usage-analysis.json')
    
    if (!fs.existsSync(analysisPath)) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
    }
    
    const analysisData = JSON.parse(fs.readFileSync(analysisPath, 'utf8'))
    
    return NextResponse.json(analysisData)
  } catch (error) {
    console.error('Error reading analysis data:', error)
    return NextResponse.json({ error: 'Failed to load analysis data' }, { status: 500 })
  }
}
