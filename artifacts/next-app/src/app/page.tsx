import { db, categoriesTable, subforumsTable, threadsTable, usersTable } from "@workspace/db";
import { asc, sql } from "drizzle-orm";
import Link from "next/link";
import { MessageSquare, MessageCircle, ChevronRight, Zap } from "lucide-react";
import { cn, formatShortDate } from "@/lib/utils";

export default async function HomePage() {
  const categories = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.sortOrder));
  const subforums = await db.select().from(subforumsTable).orderBy(asc(subforumsTable.sortOrder));

  // Get last post info per subforum
  const lastPostsResult = await db.execute(sql`
    SELECT DISTINCT ON (t.subforum_id) t.subforum_id, t.title as thread_title, u.username, t.last_post_at as created_at
    FROM threads t
    JOIN users u ON t.author_id = u.id
    ORDER BY t.subforum_id, t.last_post_at DESC NULLS LAST
  `);

  const lastPostMap = new Map<number, any>();
  for (const row of lastPostsResult.rows as any[]) {
    lastPostMap.set(row.subforum_id, {
      threadTitle: row.thread_title,
      username: row.username,
      createdAt: row.created_at,
    });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-glow mb-2">FORUM INDEX</h1>
          <p className="text-muted-foreground">Aggressive performance software and community discussions.</p>
        </div>
        <div className="flex items-center gap-4 bg-secondary/50 border border-white/5 rounded-lg px-4 py-2 backdrop-blur-sm">
          <div className="flex flex-col items-center px-4 border-r border-white/10">
            <span className="text-xl font-bold text-primary">--</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Members</span>
          </div>
          <div className="flex flex-col items-center px-4">
            <span className="text-xl font-bold text-accent">--</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Threads</span>
          </div>
        </div>
      </div>

      <div className="space-y-12">
        {categories.map((category: any) => (
          <section key={category.id} className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <div className="w-1 h-6 bg-primary rounded-full box-glow" />
              <h2 className="text-xl font-bold tracking-wider uppercase">{category.name}</h2>
              {category.description && (
                <span className="text-sm text-muted-foreground hidden md:inline-block">— {category.description}</span>
              )}
            </div>

            <div className="grid gap-3">
              {subforums
                .filter((sf: any) => sf.categoryId === category.id)
                .map((subforum: any) => {
                  const lastPost = lastPostMap.get(subforum.id);
                  return (
                    <div 
                      key={subforum.id} 
                      className="glass-panel group hover:bg-white/[0.04] transition-all duration-300 rounded-xl overflow-hidden border border-white/5"
                    >
                      <div className="p-5 flex flex-col md:flex-row items-center gap-6">
                        <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center border border-white/5 group-hover:border-primary/30 transition-colors shrink-0">
                          {subforum.requiresUpgrade ? (
                            <Zap className="w-6 h-6 text-accent animate-pulse-slow" />
                          ) : (
                            <MessageSquare className="w-6 h-6 text-primary" />
                          )}
                        </div>

                        <div className="flex-1 text-center md:text-left">
                          <Link href={`/f/${subforum.id}`} className="block group/link">
                            <h3 className="text-lg font-bold group-hover/link:text-primary transition-colors inline-flex items-center gap-2">
                              {subforum.name}
                              <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all" />
                            </h3>
                          </Link>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{subforum.description}</p>
                        </div>

                        <div className="hidden lg:grid grid-cols-1 gap-8 px-8 border-x border-white/5 text-center">
                          <div>
                            <div className="text-sm font-bold">{subforum.threadCount}</div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Threads</div>
                          </div>
                        </div>

                        <div className="w-full md:w-64 text-sm shrink-0">
                          {lastPost ? (
                            <div className="flex flex-col gap-1">
                              <div className="text-white font-medium line-clamp-1 hover:text-primary cursor-pointer transition-colors">
                                {lastPost.threadTitle}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>by <span className="text-accent underline cursor-pointer">{lastPost.username}</span></span>
                                <span>•</span>
                                <span>{formatShortDate(lastPost.createdAt)}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-muted-foreground/30 italic text-xs">Silence in this sector...</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
