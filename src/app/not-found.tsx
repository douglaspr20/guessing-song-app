import Link from "next/link";
import { Home } from "lucide-react";
import { ErrorScene } from "@/components/errors/ErrorScene";
import { LostTapeArt } from "@/components/errors/LostTapeArt";
import ui from "@/components/ui.module.css";
import { getMessages } from "@/i18n/server";

export default async function NotFound() {
  const { m } = await getMessages();
  const e = m.common.errorPage;
  return (
    <ErrorScene
      code={e.code404}
      title={
        <>
          {e.lostTitle}
          <br />
          <em>{e.lostTitleEm}</em>
        </>
      }
      lede={e.lostLede}
      actions={
        <Link href="/" className={`${ui.btn} ${ui.primary} ${ui.big}`}>
          <Home size={26} aria-hidden />
          {m.common.backToShelf}
        </Link>
      }
      art={<LostTapeArt />}
    />
  );
}
