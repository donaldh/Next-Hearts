import { socketBroadcast } from 'core/server/socket-io'
import { NextApiRequestTyped } from 'core/server/types'
import { validate } from 'core/server/zod'
import { Card, cardsList } from 'models/card'
import { PlayCardClient, processCardSwap } from 'models/game'
import { getPlayer, getRoom } from 'models/room'
import { NextApiResponse } from 'next'
import { z } from 'zod'

export const QuerySchema = z.object({
	room: z.string(),
})
export type Query = z.infer<typeof QuerySchema>

const BodySchema = z.object({
	cards: z.array(z.enum(cardsList)).length(3),
	playerID: z.string(),
})
export type Body = z.infer<typeof BodySchema>

export type Response = {
	success?: boolean
	error?: string
}

export default async function handler(
	req: NextApiRequestTyped<Query, Body>,
	res: NextApiResponse<Response>
) {
	const query = validate({ schema: QuerySchema, obj: req.query, res })
	if (!query) return
	const body = validate({ schema: BodySchema, obj: req.body, res })
	if (!body) return

	const room = getRoom(req.query.room)
	if (!room) {
		return res.status(404).json({ error: 'Room not found' })
	}

	if (!room.swapPhase) {
		return res.status(400).json({ error: 'Not in swap phase' })
	}

	const player = getPlayer(room, body.playerID)
	if (!player) {
		return res.status(400).json({ error: 'Player not found' })
	}

	// Process the card swap
	const success = processCardSwap(room.uniqueLink, body.playerID, body.cards)
	
	if (success) {
		socketBroadcast<PlayCardClient>('update-game', undefined, room.uniqueLink)
		return res.status(200).json({ success: true })
	} else {
		return res.status(400).json({ error: 'Failed to swap cards' })
	}
}
