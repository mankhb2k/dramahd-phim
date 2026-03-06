import { prisma } from "@/lib/prisma";

export default async function DashboardGenresPage() {
  const genres = await prisma.genre.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { movies: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Thể loại
        </h1>
        <p className="text-muted-foreground">{genres.length} thể loại</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[300px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 font-medium text-foreground">Tên</th>
                <th className="px-4 py-3 font-medium text-foreground">Slug</th>
                <th className="px-4 py-3 font-medium text-foreground">
                  Thứ tự
                </th>
                <th className="px-4 py-3 font-medium text-foreground">
                  Số phim
                </th>
              </tr>
            </thead>
            <tbody>
              {genres.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Chưa có thể loại. Chạy seed để tạo dữ liệu mẫu.
                  </td>
                </tr>
              ) : (
                genres.map((g: (typeof genres)[number]) => (
                  <tr
                    key={g.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {g.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {g.slug}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {g.order}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {g._count.movies}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
