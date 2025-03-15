import { memo, useCallback, useMemo } from 'react'

import { CardArea } from 'components/CardArea'

import { Player, getNextPlayer, getPreviousPlayer } from 'models/player'
import { Animation, localPlayerArea } from 'pages'

export const CardAreas = memo(function CardAreas({
	players,
	localPlayer,
	animation,
	playerToStartNextTurn,
}: {
	players: Player[]
	localPlayer?: Player
	animation?: Animation
	playerToStartNextTurn?: string
}) {
	const getPlayer = useCallback(
		(position: number) => {
			let p: Player | undefined

			p = localPlayer
			for (let i = 0; i < position; i++) {
				p = getNextPlayer(players, p)
			}

			return {
				position,
				player: p,
				numPlayers: players.length
			}
		},
		[players, localPlayer]
	)

	const getPosition = useCallback(
		(playerPublicID?: string): number => {
			const player = players.find((p) => p.publicID === playerPublicID)
			let nextPlayer = getNextPlayer(players, localPlayer)
			if (player === localPlayer) return 0
			for (let i = 1; i <= players.length; i++) {
				if (player === nextPlayer) {
					return i
				}
				nextPlayer = getNextPlayer(players, nextPlayer)
			}
			return 0
		},
		[players, localPlayer]
	)

	const nextPlayerPosition = useMemo(
		() => (animation === 'get-cards' ? getPosition(playerToStartNextTurn) : undefined),
		[playerToStartNextTurn, animation, getPosition]
	)

	const animationData = useMemo(
		() => ({
			animation,
			animateToPosition: nextPlayerPosition,
		}),
		[animation, nextPlayerPosition]
	)

	return (
		<>
		{players.map((_, index) => (
			index === 0
			? <CardArea key={index} animationData={animationData} playerData={getPlayer(index)} id={localPlayerArea}/>
			: <CardArea key={index} animationData={animationData} playerData={getPlayer(index)}/>
		))}
		</>
	)
})
