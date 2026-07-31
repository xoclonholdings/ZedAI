import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type { SearchResults } from "./types";

export function OverviewView({
  query,
  setQuery,
  searching,
  results,
  onSearch,
}: {
  query: string;
  setQuery: (value: string) => void;
  searching: boolean;
  results: SearchResults | null;
  onSearch: () => void;
}) {
  return (
    <Card className="zar-glass border-white/10">
      <CardHeader>
        <CardTitle className="text-base">Retrieval Inspector</CardTitle>
        <CardDescription>
          Search live knowledge and inspect what ZAR can actually retrieve from foundation, rules,
          project memory, scratchpad, and semantic recall.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search knowledge context..."
            className="border-white/10 bg-black/30 text-sm"
          />
          <Button onClick={onSearch} disabled={searching}>
            <Search size={14} className="mr-2" />
            {searching ? "Searching..." : "Search"}
          </Button>
        </div>

        {results ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <Card className="border-white/10 bg-black/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Foundation + Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="whitespace-pre-wrap text-sm text-foreground/85">
                    {results.foundation ||
                      results.core ||
                      "No foundation or ruleset matches were returned."}
                  </div>
                  {results.foundationTrace?.length ? (
                    <div className="space-y-3 border-t border-white/10 pt-4">
                      <div className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
                        Foundation Trace
                      </div>
                      {results.foundationTrace.map((item, index) => (
                        <div
                          key={`${item.source}-${index}`}
                          className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-foreground/85"
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="font-medium">{item.title}</span>
                            <Badge
                              variant="outline"
                              className="border-white/10 text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                            >
                              {item.source}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="border-cyan-400/20 text-cyan-300 text-[10px]"
                            >
                              score {item.score}
                            </Badge>
                          </div>
                          <div className="text-xs leading-5 text-muted-foreground">
                            {item.excerpt}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-black/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Retrieved Memory</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(results.retrieved || []).length > 0 ? (
                    results.retrieved!.map((item: any) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-foreground/85"
                      >
                        <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-cyan-300">
                          {item.source}
                        </div>
                        <div>{item.excerpt}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No semantic or episodic matches yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-white/10 bg-black/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Project Matches</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(results.project || []).length > 0 ? (
                    results.project!.map((item: any) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-foreground/85"
                      >
                        <div className="mb-1 font-medium">{item.name}</div>
                        {item.description ? (
                          <div className="mb-2 text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        ) : null}
                        <div>{item.excerpt}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No project memory matches.</div>
                  )}
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-black/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Scratchpad Matches</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(results.scratchpad || []).length > 0 ? (
                    results.scratchpad!.map((item: any) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-foreground/85"
                      >
                        {item.tags?.length ? (
                          <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-purple-300">
                            {item.tags.join(" • ")}
                          </div>
                        ) : null}
                        <div>{item.excerpt}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No scratchpad matches.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
