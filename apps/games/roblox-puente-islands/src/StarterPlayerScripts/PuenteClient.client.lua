-- PuenteClient — HUD: the term, four carry buttons, honest feedback.
-- Input is platform-native: ProximityPrompts in-world start conversations;
-- this GUI only answers. Mobile tap, mouse, and gamepad focus all work.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local answerEvent = ReplicatedStorage:WaitForChild("PuenteAnswer") :: RemoteEvent
local promptEvent = ReplicatedStorage:WaitForChild("PuentePrompt") :: RemoteEvent

local gui = Instance.new("ScreenGui")
gui.Name = "PuenteHUD"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

local frame = Instance.new("Frame")
frame.Size = UDim2.new(0, 520, 0, 300)
frame.Position = UDim2.new(0.5, -260, 1, -320)
frame.BackgroundColor3 = Color3.fromRGB(255, 253, 246)
frame.BorderSizePixel = 2
frame.Visible = false
frame.Parent = gui

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, -20, 0, 70)
title.Position = UDim2.new(0, 10, 0, 8)
title.BackgroundTransparency = 1
title.Font = Enum.Font.GothamBold
title.TextScaled = true
title.Text = ""
title.Parent = frame

local feedback = Instance.new("TextLabel")
feedback.Size = UDim2.new(1, -20, 0, 40)
feedback.Position = UDim2.new(0, 10, 1, -48)
feedback.BackgroundTransparency = 1
feedback.Font = Enum.Font.Gotham
feedback.TextScaled = true
feedback.Text = "Walk to an islander and hold the prompt."
feedback.Parent = gui

local buttons: { TextButton } = {}
for i = 1, 4 do
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0.48, 0, 0, 52)
	b.Position = UDim2.new(i % 2 == 1 and 0.01 or 0.51, 0, 0, 88 + math.floor((i - 1) / 2) * 60)
	b.BackgroundColor3 = Color3.fromRGB(201, 162, 39)
	b.Font = Enum.Font.GothamBold
	b.TextScaled = true
	b.Visible = false
	b.Parent = frame
	table.insert(buttons, b)
end

local currentId: string? = nil
promptEvent.OnClientEvent:Connect(function(payload)
	if payload.notice then
		feedback.Text = payload.notice
		return
	end
	if payload.correct ~= nil then
		if payload.correct then
			feedback.Text = string.format("Carried! +%d pts · streak %d", payload.award or 20, payload.streak or 1)
		else
			feedback.Text = string.format("Cracked. '%s' carries as '%s'. It stays with you now.", payload.es or "", payload.termEn or "")
		end
		return
	end
	currentId = payload.id
	frame.Visible = true
	title.Text = payload.sentence .. "\nCarry '" .. payload.es .. "' into English:"
	for i, b in buttons do
		local opt = payload.options[i]
		b.Text = opt or ""
		b.Visible = opt ~= nil
		b.Active = true
	end
end)

for _, b in buttons do
	b.Activated:Connect(function()
		if currentId and b.Text ~= "" then
			answerEvent:FireServer(currentId, b.Text)
			for _, x in buttons do x.Active = false end
		end
	end)
end

print("[Puente] HUD ready. Find an islander, hold Translate, carry the words.")
