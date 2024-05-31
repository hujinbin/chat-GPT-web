import Image from "next/image";
import Sider from "@/components/Sider";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <Sider></Sider>
      <div className="flex flex-col w-full h-full">
        <main className="flex-1 overflow-hidden">
          <div id="scrollRef" className="h-full overflow-hidden overflow-y-auto">
            <div
              id="image-wrapper"
              className="w-full max-w-screen-xl m-auto dark:bg-[#101014]"
            >

            </div>
          </div>
        </main>
        <footer className="footerClass bg-current">
          <div className="w-full max-w-screen-xl m-auto">
            <div className="flex items-center justify-between space-x-2">
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
