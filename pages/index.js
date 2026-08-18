import { useState, useEffect } from "react";
import Head from "next/head";

const OCCASIONS = [
  "",
  "Birthday",
  "Anniversary",
  "Valentine's Day",
  "Christmas",
  "Achievement",
  "Trip / Vacation",
  "Just Because",
  "Other",
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function occasionLabel(w) {
  return w.customOccasion || w.occasion || "";
}

const EMPTY_WISH_FORM = {
  title: "",
  description: "",
  link: "",
  occasion: "",
  customOccasion: "",
};
const EMPTY_RECEIVED_FORM = { occasion: "", customOccasion: "", date: "" };

export default function Home() {
  const [wishes, setWishes] = useState([]);
  const [owner, setOwner] = useState("Lekha");
  const [section, setSection] = useState("wishlist");
  const [loading, setLoading] = useState(true);

  // Add / edit wish modal
  const [showWishModal, setShowWishModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [wishForm, setWishForm] = useState(EMPTY_WISH_FORM);
  const [wishPhotoFile, setWishPhotoFile] = useState(null);
  const [wishPhotoPreview, setWishPhotoPreview] = useState(null);

  // Mark-as-received inline form
  const [receivedOpenId, setReceivedOpenId] = useState(null);
  const [receivedForm, setReceivedForm] = useState(EMPTY_RECEIVED_FORM);
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Detail modal (received / history click)
  const [detailItem, setDetailItem] = useState(null);

  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    loadWishes().then(() => setLoading(false));
    const interval = setInterval(loadWishes, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function loadWishes() {
    try {
      const r = await fetch("/api/wishes");
      if (r.ok) {
        setWishes(await r.json());
        setApiError(null);
      } else {
        const body = await r.json().catch(() => ({}));
        setApiError(body.error || `Server error ${r.status}`);
      }
    } catch (e) {
      setApiError(e.message);
    }
  }

  // ── Add / Edit ──────────────────────────────────────────────────────────────

  function openAddModal() {
    setEditingId(null);
    setWishForm(EMPTY_WISH_FORM);
    setWishPhotoFile(null);
    setWishPhotoPreview(null);
    setShowWishModal(true);
  }

  function openEditModal(id) {
    const w = wishes.find((x) => x.id === id);
    if (!w) return;
    setEditingId(id);
    setWishForm({
      title: w.title || "",
      description: w.description || "",
      link: w.link || "",
      occasion: w.customOccasion ? "Other" : w.occasion || "",
      customOccasion: w.customOccasion || "",
    });
    setWishPhotoFile(null);
    setWishPhotoPreview(w.photo || null);
    setShowWishModal(true);
  }

  function handleWishPhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setWishPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setWishPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleWishSubmit(e) {
    e.preventDefault();

    let photoUrl = wishPhotoPreview; // existing URL kept unless user picks new file

    if (wishPhotoFile) {
      const fd = new FormData();
      fd.append("images", wishPhotoFile);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await r.json();
      photoUrl = data.urls?.[0] ?? null;
    }

    const payload = {
      title: wishForm.title.trim(),
      description: wishForm.description.trim(),
      link: wishForm.link.trim(),
      occasion: wishForm.occasion === "Other" ? "" : wishForm.occasion,
      customOccasion:
        wishForm.occasion === "Other" ? wishForm.customOccasion.trim() : "",
      photo: photoUrl,
    };

    const r = await fetch("/api/wishes", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editingId ? { id: editingId, ...payload } : { owner, ...payload },
      ),
    });

    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      setApiError(body.error || `Save failed (${r.status})`);
      return;
    }

    setShowWishModal(false);
    loadWishes();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this wish?")) return;
    await fetch("/api/wishes?id=" + id, { method: "DELETE" });
    loadWishes();
  }

  // ── Mark as received ────────────────────────────────────────────────────────

  function openReceivedForm(id) {
    if (receivedOpenId === id) {
      setReceivedOpenId(null);
      return;
    }
    setReceivedOpenId(id);
    setReceivedForm({ ...EMPTY_RECEIVED_FORM, date: todayStr() });
    setReceivedFiles([]);
  }

  async function handleMarkReceived(wishId) {
    setUploading(true);
    let photoUrls = [];

    if (receivedFiles.length > 0) {
      const fd = new FormData();
      receivedFiles.forEach((f) => fd.append("images", f));
      try {
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await r.json();
        photoUrls = data.urls ?? [];
      } catch {
        /* continue without photos if upload fails */
      }
    }

    const occ = receivedForm.occasion;
    await fetch("/api/wishes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: wishId,
        received: true,
        receivedDate: receivedForm.date || todayStr(),
        occasion: occ === "Other" ? "" : occ,
        customOccasion:
          occ === "Other" ? receivedForm.customOccasion.trim() : "",
        receivedPhotos: photoUrls,
      }),
    });

    setUploading(false);
    setReceivedOpenId(null);
    setReceivedFiles([]);
    loadWishes();
  }

  // ── Revert to wishlist ───────────────────────────────────────────────────────

  async function handleRevert(id) {
    if (!confirm("Move this back to the wishlist?")) return;
    await fetch("/api/wishes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        received: false,
        receivedDate: null,
        receivedPhotos: [],
      }),
    });
    setDetailItem(null);
    loadWishes();
  }

  // ── Filtered lists ──────────────────────────────────────────────────────────

  const wishlistItems = wishes.filter((w) => w.owner === owner && !w.received);
  const receivedItems = wishes.filter((w) => w.owner === owner && w.received);
  const historyItems = wishes.filter((w) => w.received);

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderWishCard(w) {
    const open = receivedOpenId === w.id;
    return (
      <article key={w.id} className="card">
        <div className="photo">
          {w.photo ? (
            <img src={w.photo} alt="" />
          ) : (
            <div className="placeholder">🎁</div>
          )}
        </div>
        <div className="content">
          <div className="topline">
            <h3 className="title">{w.title}</h3>
          </div>
          {w.description && <div className="description">{w.description}</div>}
          {occasionLabel(w) && (
            <div className="status">
              For: <strong>{occasionLabel(w)}</strong>
            </div>
          )}
          <div className="actions">
            {w.link && (
              <a href={w.link} target="_blank" rel="noopener noreferrer">
                View link ↗
              </a>
            )}
            <button onClick={() => openEditModal(w.id)}>Edit</button>
            <button className="danger" onClick={() => handleDelete(w.id)}>
              Delete
            </button>
          </div>
          <button
            className="received-btn"
            onClick={() => openReceivedForm(w.id)}
          >
            {open ? "✕ Cancel" : "🎀 Mark as Received"}
          </button>

          {open && (
            <div className="received-form">
              <label>Occasion</label>
              <select
                value={receivedForm.occasion}
                onChange={(e) =>
                  setReceivedForm((f) => ({ ...f, occasion: e.target.value }))
                }
              >
                {OCCASIONS.map((o) => (
                  <option key={o} value={o}>
                    {o || "No specific occasion"}
                  </option>
                ))}
              </select>

              {receivedForm.occasion === "Other" && (
                <input
                  placeholder="Custom occasion"
                  value={receivedForm.customOccasion}
                  onChange={(e) =>
                    setReceivedForm((f) => ({
                      ...f,
                      customOccasion: e.target.value,
                    }))
                  }
                  style={{ marginTop: 7 }}
                />
              )}

              <label>Date received</label>
              <input
                type="date"
                value={receivedForm.date}
                onChange={(e) =>
                  setReceivedForm((f) => ({ ...f, date: e.target.value }))
                }
              />

              <label>Photos (optional)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setReceivedFiles(Array.from(e.target.files))}
              />
              {receivedFiles.length > 0 && (
                <div className="photo-preview-row">
                  {receivedFiles.map((f, i) => (
                    <img
                      key={i}
                      src={URL.createObjectURL(f)}
                      alt=""
                      className="photo-thumb"
                    />
                  ))}
                </div>
              )}

              <button
                className="save-btn"
                onClick={() => handleMarkReceived(w.id)}
                disabled={uploading}
              >
                {uploading ? "Saving…" : "Save as Received"}
              </button>
            </div>
          )}
        </div>
      </article>
    );
  }

  function renderReceivedCard(w) {
    const photos = w.receivedPhotos ?? [];
    const thumb = photos[0] || w.photo;
    return (
      <article
        key={w.id}
        className="card card--received"
        style={{ cursor: "pointer" }}
        onClick={() => setDetailItem(w)}
      >
        <div className="photo">
          {thumb ? (
            <img src={thumb} alt="" />
          ) : (
            <div className="placeholder">🎀</div>
          )}
        </div>
        <div className="content">
          <div className="topline">
            <h3 className="title">{w.title}</h3>
            {photos.length > 1 && (
              <span className="photo-count">
                +{photos.length - 1} photo{photos.length - 1 > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {occasionLabel(w) && (
            <div className="status">✨ {occasionLabel(w)}</div>
          )}
          {w.receivedDate && (
            <div className="status">Received {fmtDate(w.receivedDate)}</div>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              className="revert-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleRevert(w.id);
              }}
            >
              ↩ Move back to Wishlist
            </button>
          </div>
        </div>
      </article>
    );
  }

  function renderHistoryCard(w) {
    const photos = w.receivedPhotos ?? [];
    const thumb = photos[0] || w.photo;
    return (
      <div
        key={w.id}
        className="history-card"
        style={{ cursor: "pointer" }}
        onClick={() => setDetailItem(w)}
      >
        <div className="history-photo">
          {thumb ? <img src={thumb} alt="" /> : "🎁"}
        </div>
        <div className="history-info">
          <h3>{w.title}</h3>
          {occasionLabel(w) && (
            <p className="occasion">✨ {occasionLabel(w)}</p>
          )}
          {w.receivedDate && <p>Received on {fmtDate(w.receivedDate)}</p>}
          <p>For {w.owner}</p>
          {photos.length > 0 && (
            <p>
              {photos.length} photo{photos.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    );
  }

  function renderContent() {
    if (loading) {
      return (
        <div className="empty">
          <strong>Loading…</strong>
        </div>
      );
    }

    if (section === "wishlist") {
      return wishlistItems.length === 0 ? (
        <div className="empty">
          <strong>No wishes yet ✨</strong>Tap "Add a wish" to put something on
          your list.
        </div>
      ) : (
        <main className="grid">{wishlistItems.map(renderWishCard)}</main>
      );
    }

    if (section === "received") {
      return receivedItems.length === 0 ? (
        <div className="empty">
          <strong>Nothing received yet 🎀</strong>Gifts you mark as received
          will appear here.
        </div>
      ) : (
        <main className="grid">{receivedItems.map(renderReceivedCard)}</main>
      );
    }

    return historyItems.length === 0 ? (
      <div className="empty">
        <strong>Your gift story starts here 💕</strong>Received gifts will build
        your history.
      </div>
    ) : (
      <main className="grid">{historyItems.map(renderHistoryCard)}</main>
    );
  }

  function headerTitle() {
    if (section === "history") return "Our Gift History";
    if (section === "received") return `${owner}'s Received Gifts`;
    return `${owner}'s Wishlist`;
  }

  function headerCount() {
    const lists = {
      wishlist: wishlistItems,
      received: receivedItems,
      history: historyItems,
    };
    const n = lists[section].length;
    const word = section === "wishlist" ? "wish" : "gift";
    return `${n} ${word}${n !== 1 ? "s" : ""}`;
  }

  return (
    <>
      <Head>
        <title>Lekha ❤️ Suriah — Our Wishlist & Gift History</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="app">
        {apiError && (
          <div
            style={{
              background: "#fff0f0",
              border: "1px solid #f5c0c0",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 16,
              color: "#b3263e",
              fontSize: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>⚠️ {apiError}</span>
            <button
              onClick={() => setApiError(null)}
              style={{
                border: 0,
                background: "none",
                cursor: "pointer",
                color: "#b3263e",
                fontWeight: 700,
              }}
            >
              ✕
            </button>
          </div>
        )}
        <header>
          <div className="brand">
            <h1>Lekha ❤️ Suriah</h1>
            <p>Our private little wishlist</p>
          </div>
          {section === "wishlist" && (
            <button className="add-btn" onClick={openAddModal}>
              ＋ Add a wish
            </button>
          )}
        </header>

        <div className="tabs">
          {[
            { id: "wishlist", label: "🎁 Wishlist" },
            { id: "received", label: "🎀 Received" },
            { id: "history", label: "💕 Gift History" },
          ].map((t) => (
            <button
              key={t.id}
              className={`tab${section === t.id ? " active" : ""}`}
              onClick={() => setSection(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {section !== "history" && (
          <div className="person-tabs">
            {["Lekha", "Suriah"].map((name) => (
              <button
                key={name}
                className={`person${owner === name ? " active" : ""}`}
                onClick={() => setOwner(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        <div className="summary">
          <h2>{headerTitle()}</h2>
          <span className="count">{headerCount()}</span>
        </div>

        {renderContent()}

        <div className="footer">
          Made for two people who would rather get the right gift. 💕
        </div>
      </div>

      {/* ── Add / Edit wish modal ─────────────────────────────────────────── */}
      {showWishModal && (
        <div
          className="modal show"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowWishModal(false);
          }}
        >
          <div className="modal-box">
            <div className="modal-head">
              <h2>{editingId ? "Edit wish" : "Add a wish"}</h2>
              <button className="close" onClick={() => setShowWishModal(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleWishSubmit}>
              <label>Wish title *</label>
              <input
                required
                placeholder="e.g. Sony headphones"
                value={wishForm.title}
                onChange={(e) =>
                  setWishForm((f) => ({ ...f, title: e.target.value }))
                }
              />

              <label>Description</label>
              <textarea
                placeholder="Anything they should know…"
                value={wishForm.description}
                onChange={(e) =>
                  setWishForm((f) => ({ ...f, description: e.target.value }))
                }
              />

              <label>Product / website link</label>
              <input
                type="url"
                placeholder="https://…"
                value={wishForm.link}
                onChange={(e) =>
                  setWishForm((f) => ({ ...f, link: e.target.value }))
                }
              />

              <label>Occasion (optional)</label>
              <select
                value={wishForm.occasion}
                onChange={(e) =>
                  setWishForm((f) => ({ ...f, occasion: e.target.value }))
                }
              >
                {OCCASIONS.map((o) => (
                  <option key={o} value={o}>
                    {o || "No specific occasion"}
                  </option>
                ))}
              </select>
              {wishForm.occasion === "Other" && (
                <input
                  placeholder="Type a custom occasion"
                  value={wishForm.customOccasion}
                  onChange={(e) =>
                    setWishForm((f) => ({
                      ...f,
                      customOccasion: e.target.value,
                    }))
                  }
                  style={{ marginTop: 8 }}
                />
              )}

              <label>Photo</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleWishPhotoChange}
              />
              {wishPhotoPreview && (
                <img
                  src={wishPhotoPreview}
                  alt="Preview"
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    marginTop: 8,
                    maxHeight: 200,
                    objectFit: "cover",
                  }}
                />
              )}

              <button className="submit" type="submit">
                Save wish
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail modal ──────────────────────────────────────────────────── */}
      {detailItem && (
        <div
          className="modal show"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailItem(null);
          }}
        >
          <div className="modal-box">
            <div className="modal-head">
              <h2>{detailItem.title}</h2>
              <button className="close" onClick={() => setDetailItem(null)}>
                ×
              </button>
            </div>

            {detailItem.description && (
              <p className="detail-meta">{detailItem.description}</p>
            )}
            {occasionLabel(detailItem) && (
              <p className="detail-meta">
                ✨ <strong>{occasionLabel(detailItem)}</strong>
              </p>
            )}
            {detailItem.receivedDate && (
              <p className="detail-meta">
                Received on <strong>{fmtDate(detailItem.receivedDate)}</strong>
              </p>
            )}
            <p className="detail-meta">
              For <strong>{detailItem.owner}</strong>
            </p>
            {detailItem.link && (
              <p className="detail-meta">
                <a
                  href={detailItem.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View product ↗
                </a>
              </p>
            )}

            {detailItem.receivedPhotos?.length > 0 && (
              <>
                <label style={{ marginTop: 16 }}>
                  Photos ({detailItem.receivedPhotos.length})
                </label>
                <div className="photo-gallery">
                  {detailItem.receivedPhotos.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className="gallery-img"
                      onClick={() => window.open(url, "_blank")}
                    />
                  ))}
                </div>
              </>
            )}

            <button
              className="revert-btn"
              style={{ marginTop: 20, display: "block" }}
              onClick={() => handleRevert(detailItem.id)}
            >
              ↩ Move back to Wishlist
            </button>
          </div>
        </div>
      )}
    </>
  );
}
