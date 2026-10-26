-- BuildWorld — builds Puente Islands from parts (no toolbox assets to break).
-- Platform features used: ProximityPrompt (native interact), BillboardGui
-- (world speech), TweenService (bridge opening, in PuenteServer), SpawnLocation.
local Workspace = game:GetService("Workspace")

local world = Instance.new("Folder")
world.Name = "PuenteIslands"
world.Parent = Workspace

local function part(parent, name, size, pos, color, material)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.Position = pos
	p.Anchored = true
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

local GRASS = Color3.fromRGB(91, 140, 62)
local SAND = Color3.fromRGB(237, 220, 171)
local WOOD = Color3.fromRGB(146, 102, 58)
local STONE = Color3.fromRGB(120, 128, 133)

-- Plaza (spawn island)
part(world, "Plaza", Vector3.new(36, 2, 36), Vector3.new(0, 0, 0), GRASS, Enum.Material.Grass)
part(world, "PlazaSignPost", Vector3.new(1, 7, 1), Vector3.new(0, 4.5, -14), WOOD, Enum.Material.Wood)

-- Island 2: AI Lab (north), Island 3: Harbor of Records (east)
part(world, "AILabIsland", Vector3.new(30, 2, 30), Vector3.new(0, 0, -62), SAND, Enum.Material.Sand)
part(world, "HarborIsland", Vector3.new(30, 2, 30), Vector3.new(62, 0, 0), GRASS, Enum.Material.Grass)

-- Bridges start CLOSED (CanCollide false, translucent). PuenteServer opens them.
local function bridge(name, pos, size, price)
	local b = part(world, name, size, pos, WOOD, Enum.Material.WoodPlanks)
	b.CanCollide = false
	b.Transparency = 0.55
	b:SetAttribute("Price", price)
	b:SetAttribute("Open", false)
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "OpenBridgePrompt"
	prompt.ActionText = string.format("Open bridge (%d pts)", price)
	prompt.ObjectText = "Puente Bridge"
	prompt.HoldDuration = 0.6
	prompt.MaxActivationDistance = 12
	prompt.Parent = b
	return b
end
bridge("BridgeToLab", Vector3.new(0, 0.5, -31), Vector3.new(8, 1, 26), 60)
bridge("BridgeToHarbor", Vector3.new(31, 0.5, 0), Vector3.new(26, 1, 8), 140)

-- Islanders: blocky greeters with native ProximityPrompt + BillboardGui speech.
local ISLANDERS = {
	{ name = "Ada la Ingeniera", island = "Plaza", pos = Vector3.new(-8, 3.5, -8), color = Color3.fromRGB(27, 154, 170) },
	{ name = "Bruno del Modelo", island = "Plaza", pos = Vector3.new(9, 3.5, 6), color = Color3.fromRGB(201, 162, 39) },
	{ name = "Carmen de Seguridad", island = "AILabIsland", pos = Vector3.new(-6, 3.5, -66), color = Color3.fromRGB(216, 79, 53) },
	{ name = "Dario de Datos", island = "AILabIsland", pos = Vector3.new(7, 3.5, -56), color = Color3.fromRGB(70, 102, 58) },
	{ name = "Elena del Puerto", island = "HarborIsland", pos = Vector3.new(58, 3.5, -6), color = Color3.fromRGB(122, 46, 46) },
	{ name = "Felix de Registros", island = "HarborIsland", pos = Vector3.new(66, 3.5, 7), color = Color3.fromRGB(59, 68, 74) },
}
for _, spec in ipairs(ISLANDERS) do
	local npc = Instance.new("Model")
	npc.Name = spec.name
	local torso = part(npc, "Torso", Vector3.new(2, 2.4, 1), spec.pos, spec.color)
	torso.Anchored = true
	local head = part(npc, "Head", Vector3.new(1.4, 1.4, 1.4), spec.pos + Vector3.new(0, 2, 0), Color3.fromRGB(238, 195, 154))
	head.Anchored = true
	local gui = Instance.new("BillboardGui")
	gui.Name = "Speech"
	gui.Size = UDim2.new(0, 260, 0, 60)
	gui.StudsOffset = Vector3.new(0, 3.4, 0)
	gui.AlwaysOnTop = true
	gui.Parent = head
	local label = Instance.new("TextLabel")
	label.Size = UDim2.new(1, 0, 1, 0)
	label.BackgroundColor3 = Color3.fromRGB(255, 253, 246)
	label.BorderSizePixel = 2
	label.TextScaled = true
	label.Font = Enum.Font.GothamBold
	label.Text = "¡Hola! Carry my words across?"
	label.Parent = gui
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "TalkPrompt"
	prompt.ActionText = "Translate"
	prompt.ObjectText = spec.name
	prompt.HoldDuration = 0.4
	prompt.MaxActivationDistance = 12
	prompt.Parent = torso
	npc.Parent = world
end

-- Harbor wall of carried terms (updated by PuenteServer)
local wall = part(world, "CarriedWall", Vector3.new(16, 7, 1), Vector3.new(62, 4.5, -13), STONE, Enum.Material.Slate)
local wallGui = Instance.new("SurfaceGui")
wallGui.Face = Enum.NormalId.Front
wallGui.Parent = wall
local wallLabel = Instance.new("TextLabel")
wallLabel.Name = "WallText"
wallLabel.Size = UDim2.new(1, 0, 1, 0)
wallLabel.BackgroundTransparency = 1
wallLabel.TextColor3 = Color3.fromRGB(255, 248, 234)
wallLabel.TextScaled = true
wallLabel.Font = Enum.Font.GothamBold
wallLabel.Text = "TERMS CARRIED ACROSS\n— none yet —"
wallLabel.Parent = wallGui

local spawn = Workspace:FindFirstChildOfClass("SpawnLocation")
if spawn then
	spawn.Position = Vector3.new(0, 2, 10)
end
print("[Puente] World built: Plaza, AI Lab, Harbor, 2 priced bridges, 6 islanders.")
