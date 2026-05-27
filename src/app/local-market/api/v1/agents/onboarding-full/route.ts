import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export const GET = async () => {
  try {
    const res = await fetch('https://chat-agents.lobehub.com/index.json', {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const json = await res.json();
      const items = json.agents || [];
      return NextResponse.json({
        recommended: items.slice(0, 10),
        all: items,
      });
    }
    return NextResponse.json({ recommended: [], all: [] });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
};
