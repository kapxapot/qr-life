export default function Footer() {
  return (
    <div className="text-xs text-muted-foreground flex gap-2 items-center">
      <span>&copy; 2026</span>
      <span>Created by{" "}
        <a
          href="https://github.com/kapxapot"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          Sergey Atroshchenko
        </a>
      </span>

      <a
        href="https://x.com/kapxapot"
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="X (Twitter)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
    </div>
  );
}
