import Link from 'next/link'

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20">
      <p className="font-mono text-sm text-[#5B6472] mb-4">BTS · VIE · BUD · KSC</p>
      <h1 className="text-5xl font-semibold leading-tight max-w-xl mb-6">
        Find the cheapest way to fly
      </h1>
      <p className="text-lg text-[#5B6472] max-w-lg mb-10 leading-relaxed">
        One search compares Vienna, Bratislava, Budapest, and Košice —
        so you stop checking four sites separately.
      </p>

      <div className="flex flex-wrap gap-4 mb-20">
        <Link
          href="/search"
          className="inline-block px-6 py-3 bg-[#14213D] text-white rounded-sm font-medium hover:bg-[#1c2d52] transition-colors"
        >
          Search flights
        </Link>
        <Link
          href="/anywhere"
          className="inline-block px-6 py-3 border border-[#14213D] text-[#14213D] rounded-sm font-medium hover:bg-[#14213D] hover:text-white transition-colors"
        >
          Where can I fly cheaply?
        </Link>
      </div>

      <div className="border-t border-[#E5E1D8] pt-10">
        <h2 className="text-xl font-semibold mb-6">How it works</h2>
        <div className="grid sm:grid-cols-3 gap-8 text-[#5B6472]">
          <div>
            <p className="font-mono text-[#FCA311] mb-2">01</p>
            <p>Enter where you want to go</p>
          </div>
          <div>
            <p className="font-mono text-[#FCA311] mb-2">02</p>
            <p>We check all 4 nearby airports at once</p>
          </div>
          <div>
            <p className="font-mono text-[#FCA311] mb-2">03</p>
            <p>See the cheapest option, sorted by price</p>
          </div>
        </div>
      </div>
    </div>
  )
}
