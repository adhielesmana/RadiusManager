import { useQuery } from "@tanstack/react-query";
import { MapPin, Radio, Box, Wifi, Layers } from "lucide-react";
import type { Pop, Olt, DistributionBox, Onu } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CoverageMap } from "@/components/ftth/coverage-map";

export default function CoveragePage() {
  const { data: pops, isLoading: popsLoading } = useQuery<Pop[]>({
    queryKey: ['/api/pops'],
  });

  const { data: olts, isLoading: oltsLoading } = useQuery<Olt[]>({
    queryKey: ['/api/olts'],
  });

  const { data: distributionBoxes, isLoading: boxesLoading } = useQuery<DistributionBox[]>({
    queryKey: ['/api/distribution-boxes'],
  });

  const { data: onus, isLoading: onusLoading } = useQuery<Onu[]>({
    queryKey: ['/api/onus'],
  });

  const isLoading = popsLoading || oltsLoading || boxesLoading || onusLoading;

  const getOltCountForPop = (popId: number) => {
    return olts?.filter(olt => olt.popId === popId).length || 0;
  };

  const getBoxCountForOlt = (oltId: number) => {
    return distributionBoxes?.filter(box => box.oltId === oltId).length || 0;
  };

  const getOnuCountForBox = (boxId: number) => {
    return onus?.filter(onu => onu.distributionBoxId === boxId).length || 0;
  };

  const getOnusForOlt = (oltId: number) => {
    return onus?.filter(onu => onu.oltId === oltId).length || 0;
  };

  const getPopInfo = (popId: number) => {
    return pops?.find(p => p.id === popId);
  };

  const getOltInfo = (oltId: number) => {
    return olts?.find(o => o.id === oltId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading coverage data...</p>
      </div>
    );
  }

  const totalPops = pops?.length || 0;
  const totalOlts = olts?.length || 0;
  const totalBoxes = distributionBoxes?.length || 0;
  const totalOnus = onus?.length || 0;
  const activeOnus = onus?.filter(onu => onu.status === 'online').length || 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Network Coverage
        </h1>
        <p className="text-sm text-muted-foreground">
          Overview of your FTTH infrastructure coverage and deployment
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">POPs</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPops}</div>
            <p className="text-xs text-muted-foreground">Points of Presence</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OLTs</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOlts}</div>
            <p className="text-xs text-muted-foreground">Optical Line Terminals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Distribution Boxes</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBoxes}</div>
            <p className="text-xs text-muted-foreground">ODPs deployed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total ONUs</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOnus}</div>
            <p className="text-xs text-muted-foreground">Customer installations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active ONUs</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeOnus}</div>
            <p className="text-xs text-muted-foreground">Online now</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="map" className="space-y-4">
        <TabsList>
          <TabsTrigger value="map" data-testid="tab-map">Map View</TabsTrigger>
          <TabsTrigger value="hierarchy" data-testid="tab-hierarchy">Hierarchy</TabsTrigger>
          <TabsTrigger value="locations" data-testid="tab-locations">Locations</TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="space-y-4">
          {pops && olts && distributionBoxes && onus ? (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow"></div>
                      <span className="text-muted-foreground">Points of Presence (POPs)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-white shadow"></div>
                      <span className="text-muted-foreground">Distribution Boxes (ODPs)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <CoverageMap 
                pops={pops} 
                olts={olts} 
                distributionBoxes={distributionBoxes}
                onus={onus}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-[600px] border rounded-lg">
              <p className="text-muted-foreground">Loading map data...</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="hierarchy" className="space-y-4">
          <div className="grid gap-6">
            {pops && pops.map((pop) => {
              const popOlts = olts?.filter(olt => olt.popId === pop.id) || [];
              return (
                <Card key={pop.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 mt-1 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{pop.name}</CardTitle>
                          <CardDescription>
                            {pop.code} • {pop.address || 'No address'}
                            {pop.latitude && pop.longitude && (
                              <span className="ml-2 text-xs">
                                ({Number(pop.latitude).toFixed(4)}, {Number(pop.longitude).toFixed(4)})
                              </span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline">{getOltCountForPop(pop.id)} OLTs</Badge>
                    </div>
                  </CardHeader>
                  {popOlts.length > 0 && (
                    <CardContent className="space-y-4">
                      {popOlts.map((olt) => {
                        const oltBoxes = distributionBoxes?.filter(box => box.oltId === olt.id) || [];
                        const oltOnus = getOnusForOlt(olt.id);
                        return (
                          <div key={olt.id} className="ml-8 border-l-2 border-muted pl-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Radio className="h-4 w-4 text-blue-500" />
                                <span className="font-medium">{olt.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {olt.vendor}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {olt.ipAddress}
                                </span>
                              </div>
                              <div className="flex gap-2 text-xs">
                                <Badge variant="outline">{oltBoxes.length} Boxes</Badge>
                                <Badge variant="outline">{oltOnus} ONUs</Badge>
                              </div>
                            </div>
                            {oltBoxes.length > 0 && (
                              <div className="ml-6 space-y-1">
                                {oltBoxes.map((box) => {
                                  const boxOnus = getOnuCountForBox(box.id);
                                  return (
                                    <div key={box.id} className="flex items-center justify-between text-sm py-1">
                                      <div className="flex items-center gap-2">
                                        <Box className="h-3 w-3 text-amber-500" />
                                        <span className="text-muted-foreground">{box.code}</span>
                                        <span>{box.name}</span>
                                        <Badge variant="outline" className="text-xs font-mono">
                                          {box.ponPort}
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs">
                                          Slot {box.ponSlotIndex}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Wifi className="h-3 w-3" />
                                        <span className="text-xs text-muted-foreground">{boxOnus} ONUs</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="locations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {distributionBoxes && distributionBoxes
              .filter(box => box.latitude && box.longitude)
              .map((box) => {
                const olt = getOltInfo(box.oltId);
                const pop = olt ? getPopInfo(olt.popId) : null;
                const onuCount = getOnuCountForBox(box.id);
                return (
                  <Card key={box.id}>
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-amber-500" />
                        <div className="flex-1">
                          <CardTitle className="text-base">{box.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {box.code} • {box.address}
                          </CardDescription>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-xs">
                              {pop?.name || "Unknown POP"}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {olt?.name || "Unknown OLT"}
                            </Badge>
                            <Badge variant="outline" className="text-xs font-mono">
                              {box.ponPort}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">GPS Coordinates:</span>
                          <span className="font-mono text-xs">
                            {Number(box.latitude).toFixed(6)}, {Number(box.longitude).toFixed(6)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Installed ONUs:</span>
                          <span className="font-semibold">{onuCount} / 16</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
