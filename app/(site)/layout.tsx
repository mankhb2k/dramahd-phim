import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen min-w-0 flex-1 flex-col">
      <Header />
      <main className="flex min-h-[calc(100vh-8rem)] flex-1 flex-col">
        <div className="container mx-auto min-w-0 max-w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
