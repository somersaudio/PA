import Image from "next/image";
import { PlaylistForm } from "@/components/playlist/playlist-form";
import { SongLibrary } from "@/components/playlist/song-library";

export default function PlaylistParserPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Image
          src="/spotify-suno-logo.png"
          alt="Spotify + Suno"
          width={80}
          height={80}
          className="rounded"
        />
      </div>
      <PlaylistForm />
      <div className="mt-8">
        <SongLibrary />
      </div>
    </div>
  );
}
