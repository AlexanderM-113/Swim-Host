import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Scoreboard() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Mock data for display
  const currentEvent = "Event 15: Men's 100m Freestyle";
  const currentHeat = "Heat 3 of 5";
  const lanes = [
    { lane: 1, name: "Smith, J", team: "AQUA", time: "52.45", place: 4 },
    { lane: 2, name: "Johnson, M", team: "BLUE", time: "51.12", place: 2 },
    { lane: 3, name: "Williams, T", team: "WAVE", time: "50.98", place: 1 },
    { lane: 4, name: "Brown, C", team: "FAST", time: "51.87", place: 3 },
    { lane: 5, name: "Davis, R", team: "AQUA", time: "53.21", place: 5 },
    { lane: 6, name: "Miller, P", team: "BLUE", time: "54.05", place: 6 },
    { lane: 7, name: "Wilson, D", team: "WAVE", time: "54.89", place: 7 },
    { lane: 8, name: "Moore, E", team: "FAST", time: "55.12", place: 8 },
  ];

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'bg-black text-white fixed inset-0 z-50 p-8' : 'space-y-6'}`}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`${isFullscreen ? 'text-5xl' : 'text-3xl'} font-bold tracking-tight text-primary`}>
            {currentEvent}
          </h1>
          <p className={`${isFullscreen ? 'text-3xl mt-2 text-gray-400' : 'text-muted-foreground'}`}>
            {currentHeat}
          </p>
        </div>
        <Button variant={isFullscreen ? "secondary" : "default"} onClick={toggleFullscreen} className="shrink-0">
          {isFullscreen ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
          {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        </Button>
      </div>

      <div className={`flex-1 grid gap-4 ${isFullscreen ? 'grid-rows-8 mt-8' : 'grid-rows-8'}`}>
        {lanes.map((lane) => (
          <Card key={lane.lane} className={`${isFullscreen ? 'bg-gray-900 border-gray-800' : ''}`}>
            <CardContent className={`flex items-center justify-between p-4 ${isFullscreen ? 'py-6' : ''}`}>
              <div className="flex items-center gap-6">
                <div className={`font-mono font-bold ${isFullscreen ? 'text-4xl text-primary' : 'text-2xl text-primary'}`}>
                  {lane.lane}
                </div>
                <div>
                  <div className={`font-bold ${isFullscreen ? 'text-3xl' : 'text-xl'}`}>{lane.name}</div>
                  <div className={`${isFullscreen ? 'text-xl text-gray-400' : 'text-sm text-muted-foreground'}`}>{lane.team}</div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className={`font-mono font-bold ${isFullscreen ? 'text-5xl text-yellow-400' : 'text-3xl'}`}>
                  {lane.time}
                </div>
                <div className={`font-black ${isFullscreen ? 'text-5xl text-white' : 'text-3xl'}`}>
                  {lane.place}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
