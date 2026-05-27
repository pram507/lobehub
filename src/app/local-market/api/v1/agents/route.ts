import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export const GET = async (req: Request) => {
  try {
    const res = await fetch('https://chat-agents.lobehub.com/index.json', {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const json = await res.json();
      const items = json.agents || [];

      const { searchParams } = new URL(req.url);
      const limit = parseInt(searchParams.get('limit') || '0', 10);

      return NextResponse.json({
        items: limit ? items.slice(0, limit) : items,
        totalCount: items.length,
        totalPages: 1,
        currentPage: 1,
        pageSize: limit || items.length,
        categories: [],
      });
    }
    return NextResponse.json({
      items: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      pageSize: 0,
      categories: [],
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
};
