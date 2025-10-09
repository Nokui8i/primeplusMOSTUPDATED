import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const safetyPath = path.join(process.cwd(), 'safety-report.json')
    
    if (!fs.existsSync(safetyPath)) {
      return NextResponse.json({ error: 'Safety report not found' }, { status: 404 })
    }
    
    const safetyData = JSON.parse(fs.readFileSync(safetyPath, 'utf8'))
    
    return NextResponse.json(safetyData)
  } catch (error) {
    console.error('Error reading safety data:', error)
    return NextResponse.json({ error: 'Failed to load safety data' }, { status: 500 })
  }
}
