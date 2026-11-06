"use client";

import { useMemo, useState } from "react";

type Folder = "Inbox" | "Starred" | "Sent" | "Drafts" | "Spam" | "Trash";
type Message = {
  id: string;
  sender: string;
  email: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  folder: Folder;
  unread: boolean;
  starred: boolean;
  initials: string;
  tone: string;
};

const starterMessages: Message[] = [
  {
    id: "m-1",
    sender: "Maya Chen",
    email: "maya@example.com",
    subject: "The new project direction",
    preview: "I pulled together the first notes for our next milestone...",
    body: "Hi there,\n\nI pulled together the first notes for our next milestone. The main idea is to keep the first release focused, make the experience feel effortless, and test the important parts before we add more features.\n\nLet me know what you think when you have a chance.\n\nMaya",
    time: "9:42 AM",
    folder: "Inbox",
    unread: true,
    starred: true,
    initials: "MC",
    tone: "peach",
  },
  {
    id: "m-2",
    sender: "Alex Morgan",
    email: "alex@example.com",
    subject: "Design review — first pass",
    preview: "The layout is coming together. I have three small suggestions...",
    body: "Hello,\n\nThe layout is coming together. I have three small suggestions for the next pass: give the main content more breathing room, make the active navigation easier to spot, and keep the mobile experience simple.\n\nThanks,\nAlex",
    time: "Yesterday",
    folder: "Inbox",
    unread: true,
    starred: false,
    initials: "AM",
    tone: "violet",
  },
  {
    id: "m-3",
    sender: "Studio Updates",
    email: "updates@example.com",
    subject: "Your weekly product digest",
    preview: "A few highlights and useful links from this week...",
    body: "Here is your weekly product digest. This is sample content used to preview how a newsletter could look inside GAME ON MAIL.\n\nNo subscription or real email account is connected in this prototype.",
    time: "Tue",
    folder: "Inbox",
    unread: false,
    starred: false,
    initials: "SU",
    tone: "mint",
  },
  {
    id: "m-4",
    sender: "You",
    email: "you@gameon.test",
    subject: "Notes from our planning session",
    preview: "Here are the priorities we agreed to explore...",
    body: "Here are the priorities we agreed to explore:\n\n1. Start with the account experience.\n2. Build a clear and reliable inbox.\n3. Connect a test mail system only after the application foundation is ready.\n\nThis is a synthetic sent-message example.",
    time: "Mon",
    folder: "Sent",
    unread: false,
    starred: false,
    initials: "GO",
    tone: "blue",
  },
  {
    id: "m-5",
    sender: "Taylor Reed",
    email: "taylor@example.com",
    subject: "A quick follow-up",
    preview: "Just checking whether you had a chance to look at the outline...",
    body: "Hi,\n\nJust checking whether you had a chance to look at the outline. No rush — happy to discuss it whenever works.\n\nTaylor",
    time: "Oct 28",
    folder: "Inbox",
    unread: false,
    starred: false,
    initials: "TR",
    tone: "gold",
  },
];

const folderItems: { name: Folder; icon: string }[] = [
  { name: "Inbox", icon: "▤" },
  { name: "Starred", icon: "☆" },
  { name: "Sent", icon: "↗" },
  { name: "Drafts", icon: "▧" },
  { name: "Spam", icon: "⊘" },
  { name: "Trash", icon: "♲" },
];

export default function MailWorkspace() {
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [activeFolder, setActiveFolder] = useState<Folder>("Inbox");
  const [activeFilter, setActiveFilter] = useState<"All" | "Unread">("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>("m-1");
  const [composeOpen, setComposeOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");

  const visibleMessages = useMemo(() => {
    const query = search.trim().toLowerCase();
    return messages.filter((message) => {
      const folderMatch =
        activeFolder === "Starred"
          ? message.starred
          : message.folder === activeFolder;
      const filterMatch = activeFilter === "All" || message.unread;
      const searchMatch =
        !query ||
        [message.sender, message.email, message.subject, message.preview]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return folderMatch && filterMatch && searchMatch;
    });
  }, [messages, activeFolder, activeFilter, search]);

  const selectedMessage =
    visibleMessages.find((message) => message.id === selectedId) ?? null;

  function openMessage(message: Message) {
    setSelectedId(message.id);
    if (message.unread) {
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, unread: false } : item,
        ),
      );
    }
  }

  function toggleStar(id: string) {
    setMessages((current) =>
      current.map((item) =>
        item.id === id ? { ...item, starred: !item.starred } : item,
      ),
    );
  }

  function saveDraft() {
    const draft: Message = {
      id: `draft-${Date.now()}`,
      sender: "You",
      email: "you@gameon.test",
      subject: subject.trim() || "(No subject)",
      preview: body.trim().slice(0, 90) || "Empty draft",
      body,
      time: "Just now",
      folder: "Drafts",
      unread: false,
      starred: false,
      initials: "GO",
      tone: "blue",
    };
    setMessages((current) => [draft, ...current]);
    setActiveFolder("Drafts");
    setSelectedId(draft.id);
    setComposeOpen(false);
    setRecipient("");
    setSubject("");
    setBody("");
    setNotice("Draft saved in this browser session only.");
  }

  function handleSend() {
    setNotice("Sending is not connected yet. No email was sent.");
  }

  function moveToTrash(id: string) {
    setMessages((current) =>
      current.map((item) =>
        item.id === id ? { ...item, folder: "Trash" } : item,
      ),
    );
    setSelectedId(null);
    setNotice("Moved to Trash in this demo.");
  }

  const unreadCount = messages.filter(
    (message) => message.folder === "Inbox" && message.unread,
  ).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="GAME ON MAIL home">
          <span className="brand-mark">GO</span>
          <span className="brand-copy">
            <strong>GAME ON</strong>
            <small>MAIL</small>
          </span>
        </a>

        <button className="compose-button" onClick={() => setComposeOpen(true)}>
          <span className="compose-plus">＋</span>
          Compose
        </button>

        <div className="nav-label">MAILBOX</div>
        <nav className="folder-nav" aria-label="Mail folders">
          {folderItems.map((item) => {
            const count =
              item.name === "Inbox"
                ? unreadCount
                : item.name === "Drafts"
                  ? messages.filter((message) => message.folder === "Drafts")
                      .length
                  : 0;
            return (
              <button
                key={item.name}
                className={`folder-link ${activeFolder === item.name ? "active" : ""}`}
                onClick={() => {
                  setActiveFolder(item.name);
                  setSelectedId(null);
                  setActiveFilter("All");
                }}
              >
                <span className="folder-icon">{item.icon}</span>
                <span>{item.name}</span>
                {count > 0 && <span className="folder-count">{count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="storage-card">
            <div className="storage-topline">
              <span className="storage-dot" />
              <span>Demo workspace</span>
            </div>
            <strong>Mail server not connected</strong>
            <p>This preview uses sample messages. Real delivery is not enabled.</p>
          </div>
          <div className="profile-row">
            <div className="avatar avatar-blue">D</div>
            <div className="profile-copy">
              <strong>Demo account</strong>
              <span>Local preview</span>
            </div>
            <span className="profile-menu">···</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">GO</span>
            <strong>GAME ON MAIL</strong>
          </div>
          <label className="search-box">
            <span className="search-icon">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search messages..."
              aria-label="Search messages"
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-actions">
            <a className="auth-top-link" href="/sign-in">Account</a>
            <button className="icon-button" aria-label="Help" title="Help">
              ?
            </button>
            <button className="icon-button" aria-label="Settings" title="Settings">
              ⚙
            </button>
            <div className="avatar avatar-blue top-avatar">D</div>
          </div>
        </header>

        <div className="demo-banner">
          <span className="demo-badge">PREVIEW</span>
          <span>Sample inbox only — real email sending and receiving are not connected.</span>
        </div>

        {notice && (
          <div className="notice-bar" role="status">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="Dismiss message">
              ×
            </button>
          </div>
        )}

        <section className="mail-layout">
          <div className="message-column">
            <div className="mail-heading">
              <div>
                <p className="eyebrow">YOUR WORKSPACE</p>
                <h1>{activeFolder}</h1>
                <p className="mail-subtitle">
                  {activeFolder === "Inbox"
                    ? "Everything important, in one place."
                    : `Your ${activeFolder.toLowerCase()} messages.`}
                </p>
              </div>
              <button
                className="new-message-mobile"
                onClick={() => setComposeOpen(true)}
                aria-label="Compose new message"
              >
                ＋
              </button>
            </div>

            <div className="list-toolbar">
              <div className="filter-tabs">
                <button
                  className={activeFilter === "All" ? "selected" : ""}
                  onClick={() => setActiveFilter("All")}
                >
                  All mail
                </button>
                <button
                  className={activeFilter === "Unread" ? "selected" : ""}
                  onClick={() => setActiveFilter("Unread")}
                >
                  Unread
                </button>
              </div>
              <span className="message-total">{visibleMessages.length} messages</span>
            </div>

            <div className="message-list">
              {visibleMessages.length === 0 ? (
                <div className="empty-list">
                  <span className="empty-icon">✉</span>
                  <strong>No messages here</strong>
                  <p>Try another folder or search term.</p>
                </div>
              ) : (
                visibleMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`message-row ${selectedId === message.id ? "chosen" : ""} ${message.unread ? "unread" : ""}`}
                  >
                    <button
                      className="message-main"
                      onClick={() => openMessage(message)}
                    >
                      <span className={`sender-avatar ${message.tone}`}>
                        {message.initials}
                      </span>
                      <span className="message-copy">
                        <span className="message-first-line">
                          <strong>{message.sender}</strong>
                          <time>{message.time}</time>
                        </span>
                        <span className="message-subject">{message.subject}</span>
                        <span className="message-preview">{message.preview}</span>
                      </span>
                    </button>
                    <button
                      className={`star-button ${message.starred ? "starred" : ""}`}
                      onClick={() => toggleStar(message.id)}
                      aria-label={message.starred ? "Remove star" : "Add star"}
                    >
                      {message.starred ? "★" : "☆"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <section className="reading-column" aria-label="Message preview">
            {selectedMessage ? (
              <>
                <div className="reading-toolbar">
                  <span className="reading-location">
                    {activeFolder} <span>›</span> Message
                  </span>
                  <div className="reading-actions">
                    <button
                      className="small-action"
                      onClick={() => toggleStar(selectedMessage.id)}
                      title="Toggle star"
                    >
                      {selectedMessage.starred ? "★" : "☆"}
                    </button>
                    <button
                      className="small-action"
                      onClick={() => moveToTrash(selectedMessage.id)}
                      title="Move to Trash"
                    >
                      ♲
                    </button>
                  </div>
                </div>
                <article className="message-detail">
                  <div className="detail-label">MESSAGE PREVIEW</div>
                  <h2>{selectedMessage.subject}</h2>
                  <div className="sender-detail">
                    <span className={`sender-avatar large ${selectedMessage.tone}`}>
                      {selectedMessage.initials}
                    </span>
                    <div>
                      <strong>{selectedMessage.sender}</strong>
                      <span>{selectedMessage.email}</span>
                    </div>
                    <time>{selectedMessage.time}</time>
                  </div>
                  <div className="message-body">
                    {selectedMessage.body.split("\n").map((line, index) => (
                      <p key={index}>{line || "\u00a0"}</p>
                    ))}
                  </div>
                  <div className="detail-footer">
                    <button
                      className="reply-button"
                      onClick={() => {
                        setRecipient(selectedMessage.email);
                        setSubject(`Re: ${selectedMessage.subject}`);
                        setComposeOpen(true);
                      }}
                    >
                      ↶ Reply
                    </button>
                    <span>Demo content · Not a real email</span>
                  </div>
                </article>
              </>
            ) : (
              <div className="reading-empty">
                <div className="envelope-art">✉</div>
                <h2>Select a message</h2>
                <p>Choose an email from your list to read it here.</p>
              </div>
            )}
          </section>
        </section>
      </main>

      {composeOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="compose-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="compose-title"
          >
            <header className="compose-header">
              <div>
                <p className="eyebrow">NEW MESSAGE</p>
                <h2 id="compose-title">Compose email</h2>
              </div>
              <button
                className="close-button"
                onClick={() => setComposeOpen(false)}
                aria-label="Close compose window"
              >
                ×
              </button>
            </header>
            <label className="compose-field">
              <span>To</span>
              <input
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="name@example.com"
                type="email"
              />
            </label>
            <label className="compose-field">
              <span>Subject</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Add a subject"
              />
            </label>
            <label className="compose-body">
              <span className="sr-only">Message body</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Write your message..."
                rows={8}
              />
            </label>
            <div className="compose-disclaimer">
              Sending is disabled until GAME ON MAIL is connected to its mail server.
            </div>
            <footer className="compose-footer">
              <button className="secondary-button" onClick={saveDraft}>
                Save draft
              </button>
              <button
                className="send-button"
                onClick={handleSend}
                disabled
                title="Mail delivery is not connected yet"
              >
                Send <span>↗</span>
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
