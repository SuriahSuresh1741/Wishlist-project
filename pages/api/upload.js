import formidable from "formidable";
import fs from "fs";
import path from "path";
import supabase from "../../lib/supabase";

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // /tmp is the only writable directory in serverless environments
  const tmpDir = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const form = formidable({
    uploadDir: tmpDir,
    keepExtensions: true,
    multiples: true,
    maxFileSize: 15 * 1024 * 1024,
    filter: ({ mimetype }) => mimetype && mimetype.startsWith("image/"),
  });

  form.parse(req, async (err, _fields, files) => {
    if (err) return res.status(500).json({ error: err.message });

    const raw = files.images;
    const fileList = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

    try {
      const urls = await Promise.all(
        fileList.map(async (f) => {
          const buffer = fs.readFileSync(f.filepath);
          const ext = path.extname(f.originalFilename || "") || ".jpg";
          const storageName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

          const { error } = await supabase.storage
            .from("uploads")
            .upload(storageName, buffer, {
              contentType: f.mimetype ?? "image/jpeg",
            });

          fs.unlinkSync(f.filepath); // always clean up temp file
          if (error) throw error;

          const { data } = supabase.storage
            .from("uploads")
            .getPublicUrl(storageName);
          return data.publicUrl;
        }),
      );
      res.status(200).json({ urls });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
