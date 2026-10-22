import { NextResponse } from 'next/server'
import { supabase } from '../../supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('destinations')
    .select('name, slug, hostel_avg_price, food_avg_price, transport_avg_price, other_avg_price')
    .eq('airport_code', code)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ destination: null })
  }

  return NextResponse.json({ destination: data })
}
