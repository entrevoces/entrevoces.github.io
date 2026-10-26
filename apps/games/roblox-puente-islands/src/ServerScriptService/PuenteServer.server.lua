-- PuenteServer — authoritative game logic (never trust the client with points).
-- Platform features: leaderstats, DataStoreService (session fallback in Studio),
-- RemoteEvents, ProximityPrompt.Triggered, TweenService bridge opening.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")
local TweenService = game:GetService("TweenService")

local Terms = require(ReplicatedStorage:WaitForChild("PuenteTerms"))
local answerEvent = ReplicatedStorage:WaitForChild("PuenteAnswer") :: RemoteEvent
local promptEvent = ReplicatedStorage:WaitForChild("PuentePrompt") :: RemoteEvent

local store = DataStoreService:GetDataStore("PuenteIslands_v1")
local sessions: { [Player]: { term: any, streak: number } } = {}

local function getStats(player: Player)
	local ls = player:FindFirstChild("leaderstats")
	if not ls then
		ls = Instance.new("Folder")
		ls.Name = "leaderstats"
		local pts = Instance.new("IntValue")
		pts.Name = "PuentePoints"
		pts.Parent = ls
		local carried = Instance.new("IntValue")
		carried.Name = "Carried"
		carried.Parent = ls
		ls.Parent = player
	end
	return ls.PuentePoints, ls.Carried
end

local function shuffledOptions(term)
	local opts = { term.en, term.wrong[1], term.wrong[2], term.wrong[3] }
	for i = #opts, 2, -1 do
		local j = math.random(i)
		opts[i], opts[j] = opts[j], opts[i]
	end
	return opts
end

local function serveTerm(player: Player)
	local term = Terms[math.random(#Terms)]
	sessions[player] = sessions[player] or { streak = 0 }
	sessions[player].term = term
	promptEvent:FireClient(player, {
		id = term.id,
		sentence = term.sentence,
		es = term.es,
		options = shuffledOptions(term),
		streak = sessions[player].streak,
	})
end

local function onPromptTriggered(prompt: ProximityPrompt, player: Player)
	if prompt.Name == "TalkPrompt" then
		serveTerm(player)
	elseif prompt.Name == "OpenBridgePrompt" then
		local bridgePart = prompt.Parent :: BasePart
		if bridgePart:GetAttribute("Open") then return end
		local price = bridgePart:GetAttribute("Price") :: number
		local points, _ = getStats(player)
		if points.Value < price then
			promptEvent:FireClient(player, { notice = string.format("Bridge needs %d Puente Points — you hold %d. Carry more terms.", price, points.Value) })
			return
		end
		points.Value -= price
		bridgePart:SetAttribute("Open", true)
		prompt.Enabled = false
		-- TweenService: the bridge earns its solidity in front of you.
		TweenService:Create(bridgePart, TweenInfo.new(1.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Transparency = 0 }):Play()
		bridgePart.CanCollide = true
		promptEvent:FireClient(player, { notice = "The bridge is yours. It remembers who paid for it." })
	end
end

answerEvent.OnServerEvent:Connect(function(player: Player, termId: string, chosen: string)
	local s = sessions[player]
	if not s or not s.term or s.term.id ~= termId then return end -- stale/forged answers earn nothing
	local points, carried = getStats(player)
	if chosen == s.term.en then
		s.streak += 1
		local award = 20 + math.min(30, (s.streak - 1) * 5)
		points.Value += award
		carried.Value += 1
		promptEvent:FireClient(player, { correct = true, award = award, streak = s.streak, termEn = s.term.en })
		local wall = workspace:FindFirstChild("PuenteIslands") and workspace.PuenteIslands:FindFirstChild("CarriedWall")
		local wallText = wall and wall:FindFirstChildOfClass("SurfaceGui") and wall:FindFirstChildOfClass("SurfaceGui"):FindFirstChild("WallText")
		if wallText then
			wallText.Text = "TERMS CARRIED ACROSS\n" .. s.term.es .. " -> " .. s.term.en .. "\n(by " .. player.DisplayName .. ")"
		end
		task.delay(1.1, function() if player.Parent then serveTerm(player) end end)
	else
		s.streak = 0
		promptEvent:FireClient(player, { correct = false, termEn = s.term.en, es = s.term.es })
	end
end)

Players.PlayerAdded:Connect(function(player)
	local points, carried = getStats(player)
	-- DataStore: published places persist; Studio without API access stays session-only (by design, with a warning, never a crash).
	local ok, data = pcall(function() return store:GetAsync("player_" .. player.UserId) end)
	if ok and type(data) == "table" then
		points.Value = data.points or 0
		carried.Value = data.carried or 0
	elseif not ok then
		warn("[Puente] DataStore unavailable (enable Studio API access to persist):", data)
	end
	player.CharacterAdded:Connect(function()
		task.delay(0.5, function() if player.Parent then serveTerm(player) end end)
	end)
end)

Players.PlayerRemoving:Connect(function(player)
	local points, carried = getStats(player)
	pcall(function()
		store:SetAsync("player_" .. player.UserId, { points = points.Value, carried = carried.Value })
	end)
	sessions[player] = nil
end)

game:BindToClose(function()
	for _, player in Players:GetPlayers() do
		local points, carried = getStats(player)
		pcall(function()
			store:SetAsync("player_" .. player.UserId, { points = points.Value, carried = carried.Value })
		end)
	end
end)

-- Hook every islander/bridge prompt built by BuildWorld (and any re-added later).
local function hookPrompts(root: Instance)
	for _, d in root:GetDescendants() do
		if d:IsA("ProximityPrompt") then
			d.Triggered:Connect(onPromptTriggered)
		end
	end
end
hookPrompts(workspace)
workspace.DescendantAdded:Connect(function(d)
	if d:IsA("ProximityPrompt") then
		d.Triggered:Connect(onPromptTriggered)
	end
end)
print("[Puente] Server ready: leaderstats, DataStore, prompts, Tween bridges.")
