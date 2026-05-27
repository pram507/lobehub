import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export const GET = async () => {
  try {
    const res = await fetch('https://chat-plugins.lobehub.com/index.json', {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const json = await res.json();
      const items = json.plugins || [];

      const categories = new Set<string>();
      for (const item of items) {
        if (item.meta?.category) {
          categories.add(item.meta.category);
        }
      }

      return NextResponse.json(Array.from(categories).map((cat) => ({ id: cat, name: cat })));
    }
    return NextResponse.json([]);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
};
