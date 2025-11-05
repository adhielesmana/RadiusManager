import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Download, Upload, Gauge, Calendar, DollarSign, Edit, Trash2 } from "lucide-react";
import { ProfileDialog } from "@/components/profile-dialog";
import type { Profile } from "@shared/schema";

export default function Profiles() {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: profiles = [], isLoading } = useQuery<Profile[]>({
    queryKey: ['/api/profiles'],
  });

  const handleAddProfile = () => {
    setSelectedProfile(null);
    setIsDialogOpen(true);
  };

  const handleEditProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-profiles">Service Profiles</h1>
          <p className="text-sm text-muted-foreground">Manage speed plans, quotas, and pricing</p>
        </div>
        <Button onClick={handleAddProfile} data-testid="button-add-profile">
          <Plus className="mr-2 h-4 w-4" /> Add Profile
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-48 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Gauge className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-base font-medium text-muted-foreground">No service profiles</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first profile to get started</p>
            <Button onClick={handleAddProfile} className="mt-4">
              <Plus className="mr-2 h-4 w-4" /> Add Profile
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <Card key={profile.id} data-testid={`profile-card-${profile.id}`}>
              <CardHeader>
                <CardTitle className="text-lg font-semibold">{profile.name}</CardTitle>
                {profile.description && (
                  <p className="text-sm text-muted-foreground">{profile.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Download className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Download</span>
                    </div>
                    <span className="font-medium">{profile.downloadSpeed} Mbps</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Upload</span>
                    </div>
                    <span className="font-medium">{profile.uploadSpeed} Mbps</span>
                  </div>
                  {profile.dataQuota && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Data Quota</span>
                      </div>
                      <span className="font-medium">{profile.dataQuota} GB</span>
                    </div>
                  )}
                  {profile.fupThreshold && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Gauge className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">FUP Threshold</span>
                      </div>
                      <span className="font-medium">{profile.fupThreshold}%</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Validity</span>
                    </div>
                    <span className="font-medium">{profile.validityDays} days</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <span className="text-sm text-muted-foreground">Price</span>
                    </div>
                    <span className="text-xl font-bold text-primary">${Number(profile.price).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => handleEditProfile(profile)} data-testid={`button-edit-profile-${profile.id}`}>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button variant="outline" className="flex-1" data-testid={`button-delete-profile-${profile.id}`}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <ProfileDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        profile={selectedProfile}
      />
    </div>
  );
}
