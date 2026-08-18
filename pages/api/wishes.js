import supabase from "../../lib/supabase";

// Map DB row (snake_case) → app object (camelCase)
function toApp(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    owner: row.owner,
    title: row.title,
    description: row.description ?? "",
    link: row.link ?? "",
    occasion: row.occasion ?? "",
    customOccasion: row.custom_occasion ?? "",
    photo: row.photo ?? null,
    received: row.received ?? false,
    receivedDate: row.received_date ?? null,
    receivedPhotos: row.received_photos ?? [],
  };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("wishes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data.map(toApp));
  }

  if (req.method === "POST") {
    const b = req.body;
    const { data, error } = await supabase
      .from("wishes")
      .insert({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        owner: b.owner,
        title: b.title,
        description: b.description ?? "",
        link: b.link ?? "",
        occasion: b.occasion ?? "",
        custom_occasion: b.customOccasion ?? "",
        photo: b.photo ?? null,
        received: false,
        received_photos: [],
      })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(toApp(data));
  }

  if (req.method === "PUT") {
    const b = req.body;
    const patch = {};
    if (b.title !== undefined) patch.title = b.title;
    if (b.description !== undefined) patch.description = b.description;
    if (b.link !== undefined) patch.link = b.link;
    if (b.occasion !== undefined) patch.occasion = b.occasion;
    if (b.customOccasion !== undefined)
      patch.custom_occasion = b.customOccasion;
    if (b.photo !== undefined) patch.photo = b.photo;
    if (b.received !== undefined) patch.received = b.received;
    if (b.receivedDate !== undefined) patch.received_date = b.receivedDate;
    if (b.receivedPhotos !== undefined)
      patch.received_photos = b.receivedPhotos;

    const { data, error } = await supabase
      .from("wishes")
      .update(patch)
      .eq("id", b.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(toApp(data));
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing id" });
    const { error } = await supabase.from("wishes").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
