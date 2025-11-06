import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapPin, Radio, Box } from 'lucide-react';
import type { Pop, Olt, DistributionBox } from '@shared/schema';
import { Badge } from '@/components/ui/badge';

// Fix Leaflet default icon issue with bundlers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons for different infrastructure types
const createCustomIcon = (color: string, size: 'small' | 'medium' | 'large') => {
  const sizeMap = {
    small: [20, 20],
    medium: [30, 30],
    large: [40, 40],
  };
  const [width, height] = sizeMap[size];
  
  return L.divIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: ${width}px; height: ${height}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
  });
};

const popIcon = createCustomIcon('#3b82f6', 'large'); // Blue
const boxIcon = createCustomIcon('#f59e0b', 'small'); // Amber

interface FitBoundsProps {
  pops: Pop[];
  distributionBoxes: DistributionBox[];
}

function FitBounds({ pops, distributionBoxes }: FitBoundsProps) {
  const map = useMap();

  useEffect(() => {
    const allPoints: [number, number][] = [];

    pops.forEach(pop => {
      if (pop.latitude && pop.longitude) {
        allPoints.push([Number(pop.latitude), Number(pop.longitude)]);
      }
    });

    distributionBoxes.forEach(box => {
      if (box.latitude && box.longitude) {
        allPoints.push([Number(box.latitude), Number(box.longitude)]);
      }
    });

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [map, pops, distributionBoxes]);

  return null;
}

interface CoverageMapProps {
  pops: Pop[];
  olts: Olt[];
  distributionBoxes: DistributionBox[];
  onus: any[];
}

export function CoverageMap({ pops, olts, distributionBoxes, onus }: CoverageMapProps) {
  const getOltForBox = (boxOltId: number) => {
    return olts.find(olt => olt.id === boxOltId);
  };

  const getPopForOlt = (oltPopId: number) => {
    return pops.find(pop => pop.id === oltPopId);
  };

  const getOnuCountForBox = (boxId: number) => {
    return onus.filter(onu => onu.distributionBoxId === boxId).length;
  };

  const getOltCountForPop = (popId: number) => {
    return olts.filter(olt => olt.popId === popId).length;
  };

  // Default center (will be overridden by FitBounds if there are markers)
  const defaultCenter: [number, number] = [-6.2088, 106.8456]; // Jakarta, Indonesia

  return (
    <div className="h-[600px] w-full rounded-lg overflow-hidden border">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds pops={pops} distributionBoxes={distributionBoxes} />

        {/* POP Markers */}
        {pops.map(pop => {
          if (!pop.latitude || !pop.longitude) return null;
          const oltCount = getOltCountForPop(pop.id);
          
          return (
            <Marker
              key={`pop-${pop.id}`}
              position={[Number(pop.latitude), Number(pop.longitude)]}
              icon={popIcon}
            >
              <Popup>
                <div className="p-2 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    <strong className="text-base">{pop.name}</strong>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Code:</span>
                      <span className="font-mono">{pop.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">OLTs:</span>
                      <Badge variant="outline" className="text-xs">{oltCount}</Badge>
                    </div>
                    {pop.address && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-muted-foreground">{pop.address}</p>
                      </div>
                    )}
                    {pop.contactPerson && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Contact: </span>
                        {pop.contactPerson}
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Distribution Box Markers */}
        {distributionBoxes.map(box => {
          if (!box.latitude || !box.longitude) return null;
          const olt = getOltForBox(box.oltId);
          const pop = olt ? getPopForOlt(olt.popId) : null;
          const onuCount = getOnuCountForBox(box.id);
          
          return (
            <Marker
              key={`box-${box.id}`}
              position={[Number(box.latitude), Number(box.longitude)]}
              icon={boxIcon}
            >
              <Popup>
                <div className="p-2 min-w-[220px]">
                  <div className="flex items-center gap-2 mb-2">
                    <Box className="h-4 w-4 text-amber-500" />
                    <strong className="text-base">{box.name}</strong>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Code:</span>
                      <span className="font-mono">{box.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">PON Port:</span>
                      <span className="font-mono text-xs">{box.ponPort}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ONUs:</span>
                      <Badge variant="outline" className="text-xs">
                        {onuCount} / {box.maxOnus}
                      </Badge>
                    </div>
                    {pop && (
                      <div className="mt-2 pt-2 border-t space-y-1">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="text-xs">{pop.name}</span>
                        </div>
                        {olt && (
                          <div className="flex items-center gap-1">
                            <Radio className="h-3 w-3" />
                            <span className="text-xs">{olt.name}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {box.address && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-muted-foreground">{box.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
